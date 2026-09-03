/**
 * Emisión y seguimiento de facturas.
 *
 * El portal emite **directo contra el SRI**: arma el XML, lo firma con el
 * certificado del emisor y espera la autorización. La numeración, la clave de
 * acceso, el XML firmado y los cobros son suyos — no hay ningún tercero que
 * sea dueño de la factura.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { anularOrden, getOrden } from "./orden.service";
import { validarIdentificacion } from "@/lib/identificacion";
import { resolverDatoParaFacturar } from "./dato-facturacion.service";
import { hoyEnEcuador } from "@/lib/fechas";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { armarFactura, armarNotaCredito } from "@/lib/sri/comprobante";
import {
  registrarCobroPropio,
  type CobroPropioInput,
} from "./cobro.service";
import {
  emitirFacturaSri,
  emitirNotaCreditoSri,
  numeroComprobante,
} from "@/lib/sri/emision";
import type { EstadoFactura } from "@/generated/prisma/client";
import { facturaVigenteDe } from "./factura-vigente";

function ensureCanRead(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

/**
 * Plata: solo ADMIN y STAFF.
 *
 * Un `PERSONAL_ADMIN` lleva el trabajo de campo de sus sectores —sus clientes,
 * sus visitas, sus mensajes— y no ve lo que se cobra. Antes entraba con el
 * alcance de sus sectores; el corte no es "de quién es el cliente" sino "esto
 * es dinero".
 */
function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

/** Una línea tal como la arma quien emite, que puede no ser la de la orden. */
export interface LineaFacturaInput {
  productoId: string;
  /** Lo que sale impreso, tal cual: va al `descripcion` del detalle del XML. */
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
}

export interface EmitirFacturaOpciones {
  /** Con qué datos emitir. Sin esto se usa el predeterminado del cliente. */
  datoFacturacionId?: string | null;
  /**
   * Las líneas del documento. **Ausente = las de la orden, una a una**, que
   * sigue siendo el caso común: agrupar es una decisión, no el default.
   */
  lineas?: LineaFacturaInput[];
  /** Con qué emisor se emite. Ausente = el predeterminado. */
  emisorId?: string | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que salió impreso, congelado.
 *
 * La factura guarda sus propias líneas porque desde que pueden diferir de las
 * de la orden, reconstruirlas sería una mentira sobre un documento ya
 * entregado.
 */
function lineasParaGuardar(propuestas: LineaFacturaInput[]) {
  return propuestas.map((l, i) => {
    const subtotal = centavos(l.cantidad * l.precioUnitario);
    const iva = centavos((subtotal * l.ivaTasa) / 100);
    return {
      posicion: i,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      ivaTasa: l.ivaTasa,
      subtotal,
      iva,
      total: centavos(subtotal + iva),
      productoId: l.productoId,
    };
  });
}
const dinero = (n: number) => `$${centavos(n).toFixed(2)}`;

/**
 * La factura tiene que cuadrar con la orden, **base imponible por tasa**.
 *
 * Que coincida el total no alcanza: agrupar una línea al 0% con una al 15% en
 * una sola al 15% cierra el total y miente el IVA. Comparar por tasa garantiza
 * las dos cosas de una, y es lo que hace que la orden siga siendo el libro de
 * ventas aunque el papel tenga otra forma.
 */
function ensureFacturaCuadra(
  lineasOrden: { ivaTasa: unknown; subtotal: unknown }[],
  lineasFactura: LineaFacturaInput[]
): void {
  const porTasa = (
    filas: { tasa: number; base: number }[]
  ): Map<number, number> => {
    const m = new Map<number, number>();
    for (const f of filas) m.set(f.tasa, centavos((m.get(f.tasa) ?? 0) + f.base));
    return m;
  };

  const orden = porTasa(
    lineasOrden.map((l) => ({
      tasa: Number(l.ivaTasa),
      base: Number(l.subtotal),
    }))
  );
  const factura = porTasa(
    lineasFactura.map((l) => ({
      tasa: l.ivaTasa,
      base: centavos(l.cantidad * l.precioUnitario),
    }))
  );

  for (const tasa of new Set([...orden.keys(), ...factura.keys()])) {
    const a = centavos(factura.get(tasa) ?? 0);
    const b = centavos(orden.get(tasa) ?? 0);
    if (Math.abs(a - b) > 0.005) {
      throw new ValidationError(
        `El documento no cuadra con la orden: al ${tasa}% suma ${dinero(a)} y la orden ${dinero(b)}.`
      );
    }
  }
}

export interface EmitirFacturaResultado {
  facturaId: string;
  numero: string;
  estado: string;
}

export interface ListarFacturasOptions {
  clienteId?: string;
  /** Facturas que tocan esta suscripción, vía las líneas de sus órdenes. */
  suscripcionId?: string;
  estado?: string;
  limit?: number;
  offset?: number;
}

/**
 * Facturas emitidas, con el filtro que haga falta.
 *
 * La de una suscripción no es una relación directa: se llega por las líneas de
 * orden que citan alguno de sus ítems. Es el precio de tener un solo libro de
 * ventas, y a cambio una factura mixta —período + venta suelta— aparece en las
 * dos vistas, que es lo correcto.
 */
export async function listarFacturas(
  viewer: Viewer,
  options: ListarFacturasOptions = {}
) {
  ensureCanRead(viewer);

  const where: Prisma.FacturaWhereInput = {};
  if (options.estado) where.estado = options.estado as never;

  const filtrosOrden: Prisma.OrdenWhereInput = {};
  if (options.clienteId) filtrosOrden.clienteId = options.clienteId;
  if (options.suscripcionId) {
    filtrosOrden.lineas = {
      some: { suscripcionItem: { suscripcionId: options.suscripcionId } },
    };
  }
  // PERSONAL_ADMIN solo ve los clientes de sus sectores.
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    filtrosOrden.cliente = { sectorId: { in: sectores.map((s) => s.sectorId) } };
  }
  if (Object.keys(filtrosOrden).length > 0) where.orden = filtrosOrden;

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(0, options.offset ?? 0);
  const [items, total] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: {
        orden: {
          select: {
            id: true,
            numero: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, empresa: true },
            },
          },
        },
      },
      orderBy: { fechaEmision: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.factura.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function emitirFactura(
  viewer: Viewer,
  ordenId: string,
  opciones: EmitirFacturaOpciones = {}
): Promise<EmitirFacturaResultado> {
  ensureCanWrite(viewer);

  const orden = await getOrden(viewer, ordenId);
  if (orden.estado === "ANULADA") {
    throw new ConflictError("Esta orden está anulada.");
  }
  // Un borrador **sí** se factura: emitir es lo que lo confirma. El paso previo
  // dejó de existir cuando confirmar y facturar pasaron a ser el mismo momento.
  const yaEmitida = facturaVigenteDe(orden.facturas);
  if (yaEmitida) {
    throw new ConflictError(
      `Esta orden ya tiene la factura ${yaEmitida.numero}.`
    );
  }
  if (orden.lineas.length === 0) {
    throw new ValidationError("La orden no tiene productos.");
  }

  // Con qué RUC se emite. Sin elegir uno, el predeterminado: con un solo
  // emisor configurado la pregunta no existe.
  const emisorId = opciones.emisorId ?? (await emisorPorDefecto());

  // Con qué datos se factura, en orden de precedencia: lo que se elija al
  // emitir, lo que se eligió al armar la orden, y por último el predeterminado
  // del cliente. Se resuelve antes de tocar el SRI para que un cliente sin
  // datos cargados falle acá y no a mitad de la emisión.
  const dato = await resolverDatoParaFacturar(
    orden.cliente.id,
    opciones.datoFacturacionId ?? orden.datoFacturacionId
  );
  const errorId = validarIdentificacion(
    dato.tipoIdentificacion === "CEDULA" ? dato.identificacion : null,
    dato.tipoIdentificacion === "RUC" ? dato.identificacion : null
  );
  if (errorId) throw new ValidationError(errorId);

  // Qué se imprime. Sin líneas propias, las de la orden una a una; con ellas,
  // lo que armó quien emite, que puede juntar cinco trabajos en un "servicio
  // de mantenimiento".
  const deLaOrden = opciones.lineas === undefined;
  const propuestas: LineaFacturaInput[] =
    opciones.lineas ??
    orden.lineas.map((l) => ({
      productoId: l.productoId,
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      ivaTasa: Number(l.ivaTasa),
    }));

  if (propuestas.length === 0) {
    throw new ValidationError("El documento no tiene líneas.");
  }

  // Las líneas de la orden ya cuadran con la orden por construcción; las
  // armadas a mano hay que mirarlas.
  if (!deLaOrden) ensureFacturaCuadra(orden.lineas, propuestas);

  return emitirPorSri(viewer, {
    orden,
    emisorId,
    dato,
    propuestas,
    // La fecha del documento es hoy: el SRI solo autoriza comprobantes del día
    // de su emisión.
    emitidaEl: hoyEnEcuador(),
  });
}

/**
 * Con qué RUC se emite cuando nadie eligió.
 *
 * El predeterminado, y si no hay ninguno marcado, el único que haya. Sin
 * emisores configurados no se puede emitir y el mensaje dice adónde ir: es un
 * paso de configuración, no un error del pedido.
 */
async function emisorPorDefecto(): Promise<string> {
  const emisor = await prisma.emisor.findFirst({
    where: { activo: true, certificado: { not: null } },
    orderBy: { predeterminado: "desc" },
    select: { id: true },
  });
  if (!emisor) {
    throw new ValidationError(
      "No hay ningún emisor configurado con su firma electrónica. Cargalo en Configuración → Facturación electrónica."
    );
  }
  return emisor.id;
}

/**
 * Emite la factura contra el SRI, con el certificado del emisor.
 *
 * **Guarda incluso cuando el SRI no autoriza.** La clave de acceso y el número
 * ya se consumieron, así que perderlos sería dejar un hueco en la serie y no
 * poder consultar después qué pasó. La orden pasa a `CONFIRMADA` solo si quedó
 * autorizada: mientras el SRI no la acepte, no hay comprobante que entregar.
 */
async function emitirPorSri(
  viewer: Viewer,
  args: {
    orden: Awaited<ReturnType<typeof getOrden>>;
    emisorId: string;
    dato: Awaited<ReturnType<typeof resolverDatoParaFacturar>>;
    propuestas: LineaFacturaInput[];
    emitidaEl: Date;
  }
): Promise<EmitirFacturaResultado> {
  const { orden, emisorId, dato, propuestas, emitidaEl } = args;

  const productos = await prisma.producto.findMany({
    where: { id: { in: [...new Set(propuestas.map((l) => l.productoId))] } },
    select: { id: true, nombre: true, codigo: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  // El código del producto es **nuestro**: el XML del SRI lleva
  // `codigoPrincipal` como texto libre. Por eso emitir por acá no necesita que
  // el producto esté vinculado a ningún catálogo ajeno.
  const lineas = propuestas.map((l) => {
    const producto = porId.get(l.productoId);
    if (!producto) {
      throw new ValidationError(
        `"${l.descripcion}" no apunta a ningún producto del catálogo.`
      );
    }
    return {
      codigo: producto.codigo ?? producto.id.slice(-10).toUpperCase(),
      // Lo que el armador decidió imprimir, tal cual.
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      ivaTasa: l.ivaTasa,
    };
  });

  const datosSri = armarFactura(
    {
      // El portal solo distingue cédula y RUC, que es lo que factura acá.
      tipoIdentificacion: dato.tipoIdentificacion === "RUC" ? "RUC" : "CEDULA",
      identificacion: dato.identificacion,
      razonSocial: dato.razonSocial,
      direccion: dato.direccion,
    },
    lineas,
    { fecha: emitidaEl }
  );

  const emisor = await prisma.emisor.findUniqueOrThrow({
    where: { id: emisorId },
    select: { establecimiento: true, puntoEmision: true },
  });

  const r = await emitirFacturaSri(emisorId, datosSri);
  const numero = numeroComprobante(
    emisor.establecimiento,
    emisor.puntoEmision,
    r.secuencial
  );

  const totales = {
    subtotal0: centavos(
      datosSri.totalConImpuestos
        .filter((t) => t.valor === 0)
        .reduce((a, t) => a + t.baseImponible, 0)
    ),
    subtotalGravado: centavos(
      datosSri.totalConImpuestos
        .filter((t) => t.valor > 0)
        .reduce((a, t) => a + t.baseImponible, 0)
    ),
    iva: centavos(
      datosSri.totalConImpuestos.reduce((a, t) => a + t.valor, 0)
    ),
    total: datosSri.importeTotal,
  };

  /**
   * El XML firmado se guarda en R2.
   *
   * **Ese es el documento legal**, no el PDF: el RIDE es solo su
   * representación impresa, y la ley obliga a conservar el comprobante
   * electrónico. Se guarda aunque el SRI lo haya rechazado —es la prueba de
   * qué se mandó— y si la subida falla, la emisión no se cae: el comprobante
   * ya existe en el SRI y perderlo sería peor que quedarse sin la copia.
   */
  const xmlKey = `facturas/${r.claveAcceso}.xml`;
  let guardadoElXml = false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: xmlKey,
        Body: r.xmlFirmado,
        ContentType: "application/xml",
      })
    );
    guardadoElXml = true;
  } catch {
    // Queda sin `xmlKey`: se puede volver a pedir al SRI por la clave de acceso.
  }

  const factura = await prisma.$transaction(async (tx) => {
    const creada = await tx.factura.create({
      data: {
        ordenId: orden.id,
        emisorId,
        xmlKey: guardadoElXml ? xmlKey : null,
        numero,
        tipo: "FACTURA",
        fechaEmision: emitidaEl,
        estado: ESTADO_SRI[r.estado] ?? "PENDIENTE",
        claveAcceso: r.claveAcceso,
        ambienteSri: r.ambiente,
        estadoSri: r.estado,
        fechaAutorizacion: r.fechaAutorizacion,
        // En el esquema offline la clave de acceso **es** la autorización.
        autorizacion: r.numeroAutorizacion,
        mensajesSri: r.mensajes.length > 0 ? r.mensajes : undefined,
        datoFacturacionId: dato.id,
        razonSocial: dato.razonSocial,
        identificacion: dato.identificacion,
        subtotal0: totales.subtotal0,
        subtotalGravado: totales.subtotalGravado,
        iva: totales.iva,
        total: totales.total,
        // Los cobros los lleva el portal: recién emitida debe todo.
        saldo: totales.total,
        lineas: { create: lineasParaGuardar(propuestas) },
      },
    });
    if (r.estado === "AUTORIZADO") {
      await tx.orden.update({
        where: { id: orden.id },
        data: { estado: "CONFIRMADA", updatedById: viewer.id },
      });
    }
    return creada;
  });

  return {
    facturaId: factura.id,
    numero: factura.numero,
    estado: factura.estado,
  };
}

/** Lo que dice la emisión, en los estados que ya usaba la factura. */
const ESTADO_SRI: Record<string, EstadoFactura> = {
  AUTORIZADO: "AUTORIZADO",
  ENVIADO: "ENVIADO_SRI",
  FIRMADO: "FIRMADO",
  DEVUELTO: "RECHAZADO",
  RECHAZADO: "RECHAZADO",
};

/**
 * Emite una nota de crédito que corrige una factura propia.
 *
 * **Es lo que el portal puede hacer solo.** Anular el comprobante en el SRI
 * también existe, pero es un trámite manual de su portal: tiene plazo hasta el
 * día 7 del mes siguiente, necesita que el cliente acepte —y si no responde en
 * cinco días hábiles la solicitud queda sin efecto— y desde 2026 está prohibido
 * para consumidor final. La nota de crédito no depende de nada de eso.
 *
 * Por ahora acredita la factura **entera**: es el caso que hay —me equivoqué,
 * lo devuelvo— y una parcial obliga a decidir qué líneas y en qué cantidad, que
 * es otra pantalla. Las líneas salen de la factura, no de la orden: lo que se
 * acredita es lo que se le cobró.
 *
 * La orden vuelve a `BORRADOR`, igual que cuando se anula una factura:
 * `CONFIRMADA` quiere decir "tiene factura viva", y acreditada no la tiene.
 */
export async function emitirNotaCredito(
  viewer: Viewer,
  facturaId: string,
  opciones: { motivo: string }
) {
  ensureCanWrite(viewer);

  const motivo = opciones.motivo?.trim();
  if (!motivo) {
    throw new ValidationError(
      "La nota de crédito necesita un motivo: sale impreso y es lo que explica la devolución."
    );
  }

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      numero: true,
      tipo: true,
      estado: true,
      anulada: true,
      claveAcceso: true,
      emisorId: true,
      ordenId: true,
      fechaEmision: true,
      razonSocial: true,
      identificacion: true,
      datoFacturacionId: true,
      datoFacturacion: {
        select: { id: true, tipoIdentificacion: true, direccion: true },
      },
      notasDeCredito: { select: { id: true, numero: true, anulada: true } },
      lineas: {
        orderBy: { posicion: "asc" },
        select: {
          descripcion: true,
          cantidad: true,
          precioUnitario: true,
          ivaTasa: true,
          productoId: true,
          producto: { select: { codigo: true, id: true } },
        },
      },
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  await getOrden(viewer, factura.ordenId);

  if (!factura.emisorId) {
    throw new ValidationError(
      "Esta factura no tiene emisor: no hay con qué firmar la nota de crédito."
    );
  }
  if (factura.tipo === "NOTA_CREDITO") {
    throw new ValidationError("Una nota de crédito no se corrige con otra.");
  }
  // Sin autorización no hay nada que corregir: lo que hay es un envío que el
  // SRI no aceptó, y eso se arregla emitiendo de nuevo.
  if (factura.estado !== "AUTORIZADO") {
    throw new ValidationError(
      "El SRI no autorizó esta factura, así que no hay nada que acreditar."
    );
  }
  const yaTiene = factura.notasDeCredito.find((n) => !n.anulada);
  if (yaTiene) {
    throw new ValidationError(
      `Esta factura ya tiene la nota de crédito ${yaTiene.numero}.`
    );
  }

  const emisor = await prisma.emisor.findUniqueOrThrow({
    where: { id: factura.emisorId },
    select: { establecimiento: true, puntoEmision: true },
  });

  const emitidaEl = hoyEnEcuador();
  const datos = armarNotaCredito(
    {
      tipoIdentificacion:
        factura.datoFacturacion?.tipoIdentificacion === "RUC" ? "RUC" : "CEDULA",
      identificacion: factura.identificacion ?? "9999999999999",
      razonSocial: factura.razonSocial ?? "CONSUMIDOR FINAL",
      direccion: factura.datoFacturacion?.direccion,
    },
    factura.lineas.map((l) => ({
      codigo: l.producto.codigo ?? l.producto.id.slice(-10).toUpperCase(),
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      ivaTasa: Number(l.ivaTasa),
    })),
    {
      fecha: emitidaEl,
      motivo,
      numeroModificado: factura.numero,
      fechaModificado: factura.fechaEmision,
    }
  );

  const r = await emitirNotaCreditoSri(factura.emisorId, datos);
  const numero = numeroComprobante(
    emisor.establecimiento,
    emisor.puntoEmision,
    r.secuencial
  );

  // El XML de la nota también se conserva: es un comprobante como cualquier otro.
  const xmlKey = `facturas/${r.claveAcceso}.xml`;
  let guardadoElXml = false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: xmlKey,
        Body: r.xmlFirmado,
        ContentType: "application/xml",
      })
    );
    guardadoElXml = true;
  } catch {
    // Recuperable: el comprobante se puede volver a pedir por la clave.
  }

  const totales = {
    subtotal0: centavos(
      datos.totalConImpuestos
        .filter((t) => t.valor === 0)
        .reduce((a, t) => a + t.baseImponible, 0)
    ),
    subtotalGravado: centavos(
      datos.totalConImpuestos
        .filter((t) => t.valor > 0)
        .reduce((a, t) => a + t.baseImponible, 0)
    ),
    iva: centavos(datos.totalConImpuestos.reduce((a, t) => a + t.valor, 0)),
    total: datos.valorModificacion,
  };

  const nota = await prisma.$transaction(async (tx) => {
    const creada = await tx.factura.create({
      data: {
        ordenId: factura.ordenId,
        emisorId: factura.emisorId,
        facturaModificadaId: factura.id,
        motivo,
        numero,
        tipo: "NOTA_CREDITO",
        fechaEmision: emitidaEl,
        estado: ESTADO_SRI[r.estado] ?? "PENDIENTE",
        claveAcceso: r.claveAcceso,
        ambienteSri: r.ambiente,
        estadoSri: r.estado,
        fechaAutorizacion: r.fechaAutorizacion,
        autorizacion: r.numeroAutorizacion,
        mensajesSri: r.mensajes.length > 0 ? r.mensajes : undefined,
        xmlKey: guardadoElXml ? xmlKey : null,
        datoFacturacionId: factura.datoFacturacionId,
        razonSocial: factura.razonSocial,
        identificacion: factura.identificacion,
        subtotal0: totales.subtotal0,
        subtotalGravado: totales.subtotalGravado,
        iva: totales.iva,
        total: totales.total,
        // Una nota de crédito no se cobra: devuelve.
        saldo: 0,
        lineas: {
          create: factura.lineas.map((l, i) => {
            const subtotal = centavos(
              Number(l.cantidad) * Number(l.precioUnitario)
            );
            const iva = centavos((subtotal * Number(l.ivaTasa)) / 100);
            return {
              posicion: i,
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              ivaTasa: l.ivaTasa,
              subtotal,
              iva,
              total: centavos(subtotal + iva),
              productoId: l.productoId,
            };
          }),
        },
      },
    });

    // La factura queda acreditada solo si el SRI aceptó la nota: si la rechazó,
    // la factura sigue viva y hay que emitir otra nota.
    if (r.estado === "AUTORIZADO") {
      await tx.factura.update({
        where: { id: factura.id },
        data: { anulada: true },
      });
      await tx.orden.updateMany({
        where: { id: factura.ordenId, estado: "CONFIRMADA" },
        data: { estado: "BORRADOR", updatedById: viewer.id },
      });
    }
    return creada;
  });

  return {
    notaId: nota.id,
    numero: nota.numero,
    estado: nota.estado,
    claveAcceso: nota.claveAcceso,
    mensajes: r.mensajes,
  };
}

/**
 * Cobrar una orden: emite la factura si hace falta y registra el cobro.
 *
 * El orden no se puede invertir —un cobro se registra **contra** un
 * comprobante, así que la factura tiene que existir antes— pero quien cobra no
 * tiene por qué saberlo: por eso el botón dice "Registrar cobro" y por debajo
 * emite primero.
 *
 * Sobre una orden que ya tiene factura cobra contra esa, así que reintentar
 * después de una falla a mitad de camino es seguro.
 */
export async function cobrarOrden(
  viewer: Viewer,
  ordenId: string,
  cobro: CobroPropioInput
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, ordenId);

  if (orden.estado === "ANULADA") {
    throw new ConflictError("Esta orden está anulada.");
  }
  const vigente = facturaVigenteDe(orden.facturas);
  const factura = vigente
    ? { facturaId: vigente.id, numero: vigente.numero }
    : await emitirFactura(viewer, ordenId);

  await registrarCobroPropio(viewer, factura.facturaId, cobro);
  return { facturaId: factura.facturaId, numero: factura.numero };
}

/**
 * Factura la orden sin cobrarla: la venta a crédito.
 *
 * Emitir es lo que la confirma —no hay paso previo—. Si falla, la orden **se
 * queda en borrador** y el motivo vuelve en `errorFactura` con HTTP 200 en vez
 * de tirarse: borrador es el único estado editable, o sea exactamente donde hay
 * que estar para arreglar la causa.
 */
export async function facturarOrden(
  viewer: Viewer,
  ordenId: string,
  opciones: EmitirFacturaOpciones = {}
): Promise<{
  factura: EmitirFacturaResultado | null;
  errorFactura: string | null;
}> {
  try {
    return {
      factura: await emitirFactura(viewer, ordenId, opciones),
      errorFactura: null,
    };
  } catch (error) {
    return {
      factura: null,
      errorFactura: error instanceof Error ? error.message : "Error al emitir",
    };
  }
}

/**
 * Anula la orden.
 *
 * **Una factura autorizada por el SRI no se anula desde acá**: se corrige con
 * una nota de crédito, que es lo que el portal puede emitir solo. Anular el
 * comprobante en el SRI existe pero es un trámite manual de su portal —con
 * plazo hasta el día 7 del mes siguiente y con la aceptación del cliente—, así
 * que la orden no puede decidirlo por su cuenta.
 *
 * Por eso acá se corta con el motivo en vez de anular a medias: una orden
 * anulada con su factura viva en el SRI sería una mentira de nuestro lado.
 */
export async function anularOrdenCompleta(
  viewer: Viewer,
  ordenId: string,
  opciones: { liberarTrabajo?: boolean } = {}
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, ordenId);

  const vigente = facturaVigenteDe(orden.facturas);
  if (vigente) {
    throw new ConflictError(
      `Esta orden tiene la factura ${vigente.numero} autorizada por el SRI. Emitile una nota de crédito y después anulala.`
    );
  }

  const enlazado = orden.lineas.filter(
    (l) => l.origenes.length > 0 || l.suscripcionItemId
  );
  if (enlazado.length > 0 && !opciones.liberarTrabajo) {
    throw new ConflictError(
      `Esta orden tiene ${enlazado.length} ${enlazado.length === 1 ? "línea enlazada" : "líneas enlazadas"} a una visita o a una suscripción. Hay que desenlazarlas antes de anular, o vuelven a quedar sin poder facturarse.`
    );
  }

  return anularOrden(viewer, ordenId, opciones);
}

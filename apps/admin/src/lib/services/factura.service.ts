/**
 * Emisión y seguimiento de facturas.
 *
 * El portal es dueño de la orden; Contífico es dueño de la factura legal
 * (numeración SRI, XML, firma, autorización) y de los pagos. Acá solo se guarda
 * la referencia y se espeja el estado.
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
import { validarIdentificacion } from "@/lib/contifico/cedula";
import { listarCuentasBancarias } from "@/lib/contifico/bancos";
import { resolverDatoParaFacturar } from "./dato-facturacion.service";
import {
  ContificoError,
  contificoConfigurado,
  esDocumentoDuplicado,
} from "@/lib/contifico/client";
import {
  consultarEstado,
  emitirDocumento,
  enviarAlSri,
  formatearNumero,
  anularDocumento,
  mapearEstado,
  registrarCobro as registrarCobroEnContifico,
  type CobroInput,
  obtenerDocumento,
  serie,
  type LineaFactura,
} from "@/lib/contifico/documentos";

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

/**
 * Siguiente secuencial de la serie del portal.
 *
 * Se deriva del máximo ya emitido y no de un contador aparte, así no hay dos
 * fuentes que se puedan desincronizar. La unicidad de `Factura.numero` es la
 * que evita que dos emisiones simultáneas tomen el mismo número.
 */
/**
 * Siguiente secuencial libre de la serie del portal.
 *
 * Se deriva del máximo que emitió el portal. `CONTIFICO_SECUENCIAL_INICIAL`
 * actúa de piso, para cuando la serie ya tiene documentos cargados por fuera:
 * la API de Contífico no permite consultar el último número de una serie
 * (`GET /documento/` sin filtro se cuelga y no acepta filtrar por número), así
 * que el arranque hay que decírselo.
 */
async function siguienteSecuencial(
  tx: Prisma.TransactionClient
): Promise<number> {
  const { establecimiento, puntoEmision } = serie();
  const prefijo = `${establecimiento}-${puntoEmision}-`;
  const ultima = await tx.factura.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const emitido = ultima ? Number(ultima.numero.slice(prefijo.length)) : 0;
  const piso = Number(process.env.CONTIFICO_SECUENCIAL_INICIAL ?? 0);
  return Math.max(emitido, piso) + 1;
}

/** Tope de números salteados antes de darse por vencido. */
const MAX_INTENTOS_NUMERO = 25;

export interface EmitirFacturaResultado {
  facturaId: string;
  numero: string;
  estado: string;
  urlRide: string | null;
}

/**
 * Emite la factura de una orden en Contífico.
 *
 * Antes de mandar nada se valida todo lo que Contífico rechazaría, para que el
 * error no aparezca a mitad de la emisión: identificación del cliente, que la
 * orden esté confirmada, y que cada producto tenga su par en Contífico.
 */
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
  /** Con qué datos emitir. Sin esto se usa el predeterminado del cliente. */
  datoFacturacionId?: string | null
): Promise<EmitirFacturaResultado> {
  ensureCanWrite(viewer);

  if (!contificoConfigurado()) {
    throw new ValidationError(
      "Falta configurar CONTIFICO_API_KEY y CONTIFICO_TOKEN."
    );
  }

  const orden = await getOrden(viewer, ordenId);

  if (orden.estado === "ANULADA") {
    throw new ConflictError("Esta orden está anulada.");
  }
  // Un borrador **sí** se factura: emitir es lo que lo confirma. El paso previo
  // dejó de existir cuando confirmar y facturar pasaron a ser el mismo momento.
  const yaEmitida = orden.facturas.find((f) => !f.anulada);
  if (yaEmitida) {
    throw new ConflictError(
      `Esta orden ya tiene la factura ${yaEmitida.numero}.`
    );
  }
  if (orden.lineas.length === 0) {
    throw new ValidationError("La orden no tiene productos.");
  }

  // Con qué datos se factura, en orden de precedencia: lo que se elija al
  // emitir, lo que se eligió al armar la orden, y por último el predeterminado
  // del cliente. Se resuelve antes de tocar Contífico para que un cliente sin
  // datos cargados falle acá y no a mitad de la emisión.
  const dato = await resolverDatoParaFacturar(
    orden.cliente.id,
    datoFacturacionId ?? orden.datoFacturacionId
  );
  const errorId = validarIdentificacion(
    dato.tipoIdentificacion === "CEDULA" ? dato.identificacion : null,
    dato.tipoIdentificacion === "RUC" ? dato.identificacion : null
  );
  if (errorId) throw new ValidationError(errorId);

  // Cada producto necesita su par en Contífico: `producto_id` es obligatorio y
  // no existen líneas de texto libre.
  //
  // Acá **no** se sincroniza: un producto sin vincular no puede entrar en una
  // orden, así que si llegó hasta acá es que ya está. Sincronizar al emitir
  // escondía la decisión de escribir en el catálogo ajeno detrás del botón de
  // facturar, que es el peor momento para descubrir un problema.
  const lineas: LineaFactura[] = [];
  for (const linea of orden.lineas) {
    if (!linea.producto.contificoProductoId) {
      throw new ValidationError(
        `"${linea.producto.nombre}" no está sincronizado con Contífico. Vinculalo desde la ficha del producto antes de facturar.`
      );
    }
    lineas.push({
      contificoProductoId: linea.producto.contificoProductoId,
      cantidad: Number(linea.cantidad),
      precioUnitario: Number(linea.precioUnitario),
      ivaTasa: Number(linea.ivaTasa),
    });
  }

  // El número se reserva en una transacción corta; la llamada a Contífico va
  // afuera para no sostener la transacción durante la red.
  let secuencial = await prisma.$transaction((tx) => siguienteSecuencial(tx));

  const datosCliente = {
    cedula: dato.tipoIdentificacion === "CEDULA" ? dato.identificacion : null,
    ruc: dato.tipoIdentificacion === "RUC" ? dato.identificacion : null,
    razonSocial: dato.razonSocial,
    tipoPersona: dato.tipoPersona,
    direccion: dato.direccion,
    telefono: dato.telefono,
    email: dato.email,
  };

  // El secuencial sale de lo que emitió el portal, pero la serie puede tener
  // documentos cargados por fuera. Si el número está tomado, se avanza al
  // siguiente en vez de fallar.
  //
  // Ojo: ante un número repetido Contífico **no siempre da error**. A veces
  // responde 200 con el documento que ya existía, y sin este chequeo el portal
  // lo adoptaba como si lo hubiera creado —llegó a marcar una orden como
  // facturada apuntando a una factura vieja y anulada—. Por eso no alcanza con
  // atrapar el error: hay que mirar lo que volvió.
  let documento;
  let numero = formatearNumero(secuencial);
  for (let intento = 0; intento < MAX_INTENTOS_NUMERO; intento++) {
    numero = formatearNumero(secuencial);
    try {
      const creado = await emitirDocumento({
        numero,
        fechaEmision: orden.fecha,
        cliente: datosCliente,
        lineas,
        descripcion: `Orden #${orden.numero}`,
      });

      const yaExistia =
        creado.estado === "A" ||
        Math.abs(Number(creado.total) - Number(orden.total)) > 0.01;
      if (yaExistia) {
        secuencial += 1;
        continue;
      }

      documento = creado;
      break;
    } catch (error) {
      if (esDocumentoDuplicado(error)) {
        secuencial += 1;
        continue;
      }
      if (error instanceof ContificoError) {
        throw new ValidationError(
          `Contífico rechazó la factura: ${error.message}`
        );
      }
      throw error;
    }
  }
  if (!documento) {
    throw new ConflictError(
      `No se encontró un número libre en la serie después de ${MAX_INTENTOS_NUMERO} intentos. Revisá la numeración con Contífico.`
    );
  }

  const factura = await prisma.$transaction(async (tx) => {
    const creada = await tx.factura.create({
      data: {
        ordenId: orden.id,
        contificoDocumentoId: documento.id,
        numero: documento.documento ?? numero,
        fechaEmision: orden.fecha,
        estado: "PENDIENTE",
        autorizacion: documento.autorizacion || null,
        urlRide: documento.url_ride || null,
        urlXml: documento.url_xml || null,
        contificoPersonaId: documento.persona_id || null,
        // Referencia + snapshot: el dato puede editarse o archivarse después, y
        // lo que se imprimió en el papel no cambia.
        datoFacturacionId: dato.id,
        razonSocial: dato.razonSocial,
        identificacion: dato.identificacion,
        subtotal0: 0,
        subtotalGravado: orden.subtotal,
        iva: orden.iva,
        total: orden.total,
        // Recién emitida no tiene cobros, así que debe todo. Se actualiza al
        // sincronizar contra Contífico, que es quien lleva los cobros.
        saldo: orden.total,
      },
    });
    await tx.orden.update({
      where: { id: orden.id },
      data: { estado: "CONFIRMADA", updatedById: viewer.id },
    });
    return creada;
  });

  return {
    facturaId: factura.id,
    numero: factura.numero,
    estado: factura.estado,
    urlRide: factura.urlRide,
  };
}

/**
 * Refresca el estado desde Contífico. La firma y la autorización del SRI son
 * asincrónicas: Contífico procesa los pendientes cada hora.
 */
export async function sincronizarFactura(viewer: Viewer, facturaId: string) {
  ensureCanWrite(viewer);
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: { id: true, contificoDocumentoId: true, ordenId: true },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  // Valida el acceso del viewer a la orden.
  await getOrden(viewer, factura.ordenId);

  if (!factura.contificoDocumentoId) {
    throw new ValidationError("Esta factura no está vinculada a Contífico.");
  }

  return refrescarDesdeContifico(
    { id: factura.id, contificoDocumentoId: factura.contificoDocumentoId, ordenId: factura.ordenId },
    viewer.id
  );
}

/**
 * Relee una factura en Contífico y guarda lo que diga. Sin autorización: la
 * hacen tanto una persona (ya validada) como el cron.
 */
async function refrescarDesdeContifico(
  factura: { id: string; contificoDocumentoId: string; ordenId: string },
  actorId: string | null
) {
  // Dos llamadas porque son dos cosas distintas: `/estado/` da el avance de la
  // firma electrónica, y el documento da el cobro y la anulación. Ese endpoint
  // **no** delata una anulación —devuelve "No se ha firmado" igual que un
  // documento nuevo—, así que sin leer el documento el portal nunca se enteraría
  // de que la anularon desde la interfaz de Contífico.
  const [{ estado }, documento] = await Promise.all([
    consultarEstado(factura.contificoDocumentoId),
    obtenerDocumento(factura.contificoDocumentoId),
  ]);

  return marcarLocal(actorId, factura.id, factura.ordenId, {
    estadoSri: mapearEstado(estado),
    // `anulado` y `estado === "A"` dicen lo mismo; se miran los dos por si
    // alguno viniera vacío.
    anulada: documento.anulado === true || documento.estado === "A",
    saldo: documento.saldo,
    // Al emitir todavía no existen: los genera la firma, que llega después.
    urlRide: documento.url_ride,
    urlXml: documento.url_xml,
  });
}

/**
 * Escribe en el portal lo que dice Contífico.
 *
 * Lo comparten sincronizar y anular: la consecuencia de una anulación es la
 * misma venga de la interfaz de Contífico o de acá.
 */
async function marcarLocal(
  /** Quién lo hizo. `null` cuando lo hizo el cron. */
  actorId: string | null,
  facturaId: string,
  ordenId: string,
  datos: {
    estadoSri?: string;
    anulada: boolean;
    saldo?: string | null;
    urlRide?: string | null;
    urlXml?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.factura.update({
      where: { id: facturaId },
      data: {
        ...(datos.estadoSri ? { estado: datos.estadoSri as never } : {}),
        anulada: datos.anulada,
        ...(datos.saldo !== undefined
          ? {
              saldo:
                datos.saldo != null ? new Prisma.Decimal(datos.saldo) : null,
            }
          : {}),
        // Solo si vinieron: un refresco que no los trae no puede borrar los
        // que ya teníamos.
        ...(datos.urlRide ? { urlRide: datos.urlRide } : {}),
        ...(datos.urlXml ? { urlXml: datos.urlXml } : {}),
      },
    });

    // Anulada la única factura, la orden vuelve a `BORRADOR`.
    //
    // `CONFIRMADA` significa "tiene factura viva": quedarse ahí sin ninguna
    // sería mentir. Y volver a borrador la deja editable, que es lo que hace
    // falta, porque si la anularon fue porque algo estaba mal.
    if (datos.anulada) {
      const vigentes = await tx.factura.count({
        where: { ordenId, anulada: false },
      });
      if (vigentes === 0) {
        await tx.orden.updateMany({
          where: { id: ordenId, estado: "CONFIRMADA" },
          data: { estado: "BORRADOR", updatedById: actorId },
        });
      }
    }

    return actualizada;
  });
}

/**
 * Los cobros de una factura, leídos de Contífico.
 *
 * No se guardan acá: son suyos. Se piden en el momento para que la pantalla no
 * muestre una lista vieja si alguien cargó un cobro por su interfaz.
 */
export async function listarCobros(viewer: Viewer, facturaId: string) {
  ensureCanRead(viewer);
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: { ordenId: true, total: true, contificoDocumentoId: true },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  await getOrden(viewer, factura.ordenId);
  if (!factura.contificoDocumentoId) {
    throw new ValidationError("Esta factura no está vinculada a Contífico.");
  }

  const documento = await obtenerDocumento(factura.contificoDocumentoId);
  const cobros = documento.cobros ?? [];

  // Contífico devuelve solo el id de la cuenta, y un id no le dice nada a
  // nadie. Se resuelve el nombre, pero únicamente si hay alguna transferencia:
  // es otra llamada y la mayoría de los cobros no lo son. Si falla, se sigue
  // sin el nombre — un cobro no se deja de mostrar por eso.
  const cuentas = new Map<string, string>();
  if (cobros.some((c) => c.cuenta_bancaria_id)) {
    try {
      for (const cta of await listarCuentasBancarias()) {
        cuentas.set(cta.id, `${cta.nombre} · ${cta.numero}`);
      }
    } catch {
      // Sin nombres; abajo cae en null.
    }
  }

  return {
    total: Number(factura.total),
    saldo: documento.saldo != null ? Number(documento.saldo) : null,
    cobros: cobros.map((c) => ({
      id: c.id,
      formaCobro: c.forma_cobro,
      monto: Number(c.monto),
      fecha: c.fecha,
      // En efectivo el comprobante es la etiqueta que puso Contífico, no algo
      // que alguien haya escrito: mostrarlo sería mostrar ruido.
      comprobante: c.forma_cobro === "TRA" ? c.numero_comprobante : null,
      numeroCheque: c.numero_cheque,
      fechaCheque: c.fecha_cheque,
      cuentaBancaria: c.cuenta_bancaria_id
        ? (cuentas.get(c.cuenta_bancaria_id) ?? null)
        : null,
      tipoPing: c.tipo_ping,
      numeroTarjeta: c.numero_tarjeta,
      lote: c.lote,
    })),
  };
}

/**
 * Registra un cobro contra una factura.
 *
 * Los cobros los lleva Contífico, no el portal: acá se manda el cobro y se
 * relee el `saldo`. Por eso no hay un "marcar como pagada" — el estado sale de
 * los cobros, y la factura queda saldada cuando el saldo llega a cero.
 */
export async function registrarCobro(
  viewer: Viewer,
  facturaId: string,
  cobro: CobroInput
) {
  ensureCanWrite(viewer);

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      ordenId: true,
      numero: true,
      anulada: true,
      total: true,
      saldo: true,
      contificoDocumentoId: true,
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  await getOrden(viewer, factura.ordenId);

  if (factura.anulada) {
    throw new ConflictError(`La factura ${factura.numero} está anulada.`);
  }
  if (!factura.contificoDocumentoId) {
    throw new ValidationError("Esta factura no está vinculada a Contífico.");
  }
  if (cobro.monto <= 0) {
    throw new ValidationError("El monto tiene que ser mayor a cero.");
  }
  if (cobro.formaCobro === "TRA" && !cobro.cuentaBancariaId) {
    throw new ValidationError(
      "Una transferencia necesita la cuenta bancaria de Contífico."
    );
  }
  if (cobro.formaCobro === "TC" && !cobro.tipoPing) {
    throw new ValidationError("Elegí con qué datáfono se cobró.");
  }

  // El saldo guardado puede estar viejo: se relee antes de validar contra él.
  const antes = await obtenerDocumento(factura.contificoDocumentoId);
  const saldo = Number(antes.saldo);
  if (cobro.monto > saldo + 0.001) {
    throw new ValidationError(
      `El cobro (${cobro.monto.toFixed(2)}) supera el saldo de la factura (${saldo.toFixed(2)}).`
    );
  }

  await registrarCobroEnContifico(factura.contificoDocumentoId, cobro);

  // El saldo nuevo lo dice Contífico, no se calcula acá: si alguien cargó otro
  // cobro por su interfaz, la resta local daría un número que no existe.
  const despues = await obtenerDocumento(factura.contificoDocumentoId);
  return prisma.factura.update({
    where: { id: factura.id },
    data: {
      saldo:
        despues.saldo != null ? new Prisma.Decimal(despues.saldo) : null,
    },
  });
}

/**
 * Anula la factura en Contífico y lo refleja acá.
 *
 * **No se anula una factura autorizada por el SRI.** Autorizada quiere decir
 * que el comprobante ya existe para el fisco; deshacerlo tiene su propio
 * trámite y plazos, y comercialmente lo que corresponde es una nota de crédito.
 * Si Contífico llegara a aceptar el PUT igual, sería una inconsistencia entre
 * su base y la del SRI, así que se corta acá.
 */
export async function anularFactura(viewer: Viewer, facturaId: string) {
  ensureCanWrite(viewer);

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      ordenId: true,
      numero: true,
      estado: true,
      anulada: true,
      contificoDocumentoId: true,
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  await getOrden(viewer, factura.ordenId);

  if (factura.anulada) {
    throw new ConflictError(`La factura ${factura.numero} ya está anulada.`);
  }
  if (!factura.contificoDocumentoId) {
    throw new ValidationError("Esta factura no está vinculada a Contífico.");
  }
  if (factura.estado === "AUTORIZADO") {
    throw new ConflictError(
      `La factura ${factura.numero} ya fue autorizada por el SRI: no se anula, se emite una nota de crédito.`
    );
  }

  // Lo cobrado también se relee: alguien pudo terminar de cobrarla desde la
  // interfaz de Contífico y el saldo guardado sería de antes.
  //
  // **Cobrada del todo no se anula.** Contífico la anula igual —lo probamos con
  // un cobro parcial encima—, pero anular una factura ya saldada deja la plata
  // cobrada sin nada que la respalde. Parcialmente cobrada sí: ahí todavía hay
  // una operación abierta que se puede dar de baja.
  const antes = await obtenerDocumento(factura.contificoDocumentoId);
  if (antes.saldo != null && Number(antes.saldo) <= 0.001) {
    throw new ConflictError(
      `La factura ${factura.numero} ya está cobrada por completo: no se anula. Si hay que devolver la plata, va una nota de crédito.`
    );
  }

  // El estado guardado puede estar viejo. Se relee antes de tocar nada, porque
  // Contífico firma por lotes y la factura pudo firmarse hace un minuto.
  //
  // **La firma es el límite, no la autorización.** Anular es un
  // `PUT /documento/`, y sobre un documento firmado Contífico responde
  // `1045 "El documento ya se encuentra firmado o autorizado, no es posible
  // realizar cambios"`. Como firma sola en su tanda horaria, la ventana para
  // anular es corta y no la maneja nadie de este lado.
  const { estado } = await consultarEstado(factura.contificoDocumentoId);
  const estadoSri = mapearEstado(estado);
  if (estadoSri !== "PENDIENTE") {
    await prisma.factura.update({
      where: { id: factura.id },
      data: { estado: estadoSri as never },
    });
    throw new ConflictError(
      estadoSri === "AUTORIZADO"
        ? `La factura ${factura.numero} ya fue autorizada por el SRI: no se anula, se emite una nota de crédito.`
        : `Contífico ya firmó la factura ${factura.numero} y no acepta cambios sobre un documento firmado. Para darla de baja va una nota de crédito.`
    );
  }

  await anularDocumento(factura.contificoDocumentoId);

  const documento = await obtenerDocumento(factura.contificoDocumentoId);
  if (!documento.anulado && documento.estado !== "A") {
    throw new ConflictError(
      "Contífico aceptó el pedido pero la factura sigue activa. Anulala desde su interfaz."
    );
  }

  return marcarLocal(viewer.id, factura.id, factura.ordenId, {
    anulada: true,
    saldo: documento.saldo,
  });
}

/**
 * Cobrar una orden: emite la factura si hace falta y registra el cobro.
 *
 * El orden no se puede invertir: **un cobro se registra contra un documento de
 * Contífico**, así que la factura tiene que existir antes. Por eso el botón
 * dice "Registrar cobro" y por debajo emite primero — quien cobra no tiene por
 * qué saber que hay un documento que crear.
 *
 * Sobre una orden que ya tiene factura cobra contra esa, así que reintentar
 * después de una falla a mitad de camino es seguro.
 */
export async function cobrarOrden(
  viewer: Viewer,
  ordenId: string,
  cobro: CobroInput
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, ordenId);

  if (orden.estado === "ANULADA") {
    throw new ConflictError("Esta orden está anulada.");
  }
  const vigente = orden.facturas.find((f) => !f.anulada);
  const factura = vigente
    ? { facturaId: vigente.id, numero: vigente.numero }
    : await emitirFactura(viewer, ordenId);

  await registrarCobro(viewer, factura.facturaId, cobro);
  return { facturaId: factura.facturaId, numero: factura.numero };
}

/**
 * Anula la orden y, con ella, su factura.
 *
 * Una orden tiene una factura: anular una cosa anula la otra, y no hay forma de
 * dejarlas en desacuerdo. Para volver a cobrar el trabajo se arma una orden
 * nueva.
 *
 * El trabajo enlazado se chequea **antes de tocar Contífico**: anular allá y
 * fallar acá dejaría la factura muerta y la orden viva, que es el peor de los
 * dos mundos y encima no se deshace.
 */
export async function anularOrdenCompleta(
  viewer: Viewer,
  ordenId: string,
  opciones: { liberarTrabajo?: boolean } = {}
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, ordenId);

  const enlazado = orden.lineas.filter(
    (l) => l.visitaProductoId || l.suscripcionItemId
  );
  if (enlazado.length > 0 && !opciones.liberarTrabajo) {
    throw new ConflictError(
      `Esta orden tiene ${enlazado.length} ${enlazado.length === 1 ? "línea enlazada" : "líneas enlazadas"} a una visita o a una suscripción. Hay que desenlazarlas antes de anular, o vuelven a quedar sin poder facturarse.`
    );
  }

  const vigente = orden.facturas.find((f) => !f.anulada);
  if (vigente) await anularFactura(viewer, vigente.id);

  // `anularFactura` devolvió la orden a BORRADOR al no quedarle facturas vivas,
  // así que este segundo paso encuentra una orden anulable.
  return anularOrden(viewer, ordenId, opciones);
}

/**
 * Factura la orden sin cobrarla: la venta a crédito.
 *
 * Emitir es lo que la confirma —no hay paso previo— y **no** manda nada al SRI:
 * crea el documento en Contífico, que después firma sola y transmite en su
 * tanda horaria.
 *
 * Si falla, la orden **se queda en borrador** y el motivo vuelve en
 * `errorFactura` con HTTP 200 en vez de tirarse. Borrador es el único estado
 * editable, o sea exactamente donde hay que estar para arreglar la causa:
 * vincular el producto que faltaba, cargarle los datos al cliente.
 */
export async function facturarOrden(
  viewer: Viewer,
  ordenId: string
): Promise<{
  factura: EmitirFacturaResultado | null;
  errorFactura: string | null;
}> {
  try {
    return { factura: await emitirFactura(viewer, ordenId), errorFactura: null };
  } catch (error) {
    return {
      factura: null,
      errorFactura: error instanceof Error ? error.message : "Error al emitir",
    };
  }
}

/**
 * Pone al día todas las facturas que todavía pueden cambiar. Corre desde el
 * cron, sin viewer: es un proceso del sistema.
 *
 * **Existe porque Contífico no avisa nada.** Firma, transmite y recibe la
 * autorización del SRI por su cuenta, y `url_ride` / `url_xml` recién aparecen
 * cuando firma. Sin esto, una factura se quedaba en "Sin firmar" y sin PDF
 * hasta que alguien abriera la orden y apretara "Actualizar" a mano — y nadie
 * tiene por qué sospechar que hay algo que refrescar.
 *
 * El corte es "ya no queda nada por saber": anulada, o autorizada y saldada.
 * Todo lo demás puede cambiar de estado o recibir un cobro cargado desde la
 * interfaz de Contífico, así que se relee.
 *
 * Los errores no cortan la corrida: una factura que Contífico no devuelve no
 * puede dejar sin actualizar a las demás. Se cuentan y se reportan.
 */
export async function sincronizarPendientes(limite = 100) {
  const pendientes = await prisma.factura.findMany({
    where: {
      anulada: false,
      contificoDocumentoId: { not: null },
      NOT: { AND: [{ estado: "AUTORIZADO" }, { saldo: 0 }] },
    },
    orderBy: { fechaEmision: "desc" },
    take: limite,
    select: { id: true, numero: true, contificoDocumentoId: true, ordenId: true },
  });

  let actualizadas = 0;
  const fallidas: { numero: string; motivo: string }[] = [];

  // De a una y en serie: son dos llamadas por factura y no hay apuro. Un cron
  // que le tira cien pedidos en paralelo a Contífico es la forma de descubrir
  // su rate limit en producción.
  for (const f of pendientes) {
    try {
      await refrescarDesdeContifico(
        {
          id: f.id,
          contificoDocumentoId: f.contificoDocumentoId!,
          ordenId: f.ordenId,
        },
        null
      );
      actualizadas += 1;
    } catch (error) {
      fallidas.push({
        numero: f.numero,
        motivo: error instanceof Error ? error.message : "Error",
      });
    }
  }

  return {
    revisadas: pendientes.length,
    actualizadas,
    fallidas,
    // Con el tope alcanzado quedaron facturas sin mirar: la próxima corrida las
    // toma, pero conviene saberlo antes de que se vuelva crónico.
    truncado: pendientes.length === limite,
  };
}

/**
 * Empuja la factura al SRI sin esperar el proceso horario de Contífico.
 *
 * **La firma no se pide: Contífico firma solo.** Verificado el 23/08/2026 sobre
 * `001-002-000900007`, que llegó a `firmado: true` sin que nadie llamara a
 * nada. Esto solo adelanta el envío de un documento ya firmado.
 *
 * `PUT /documento/<id>/sri/` responde 200 en medio segundo con el documento
 * entero, pero **encola**: el estado no cambia en la misma llamada. Por eso
 * `sincronizarFactura` al final puede devolver el mismo estado que antes; no es
 * un error.
 */
export async function reenviarAlSri(viewer: Viewer, facturaId: string) {
  ensureCanWrite(viewer);
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      contificoDocumentoId: true,
      ordenId: true,
      anulada: true,
      estado: true,
    },
  });
  if (!factura?.contificoDocumentoId) {
    throw new NotFoundError("Factura no encontrada");
  }
  // Quedó sin probar si el PUT desanula —no había ninguna anulada con la que
  // arriesgarse—, y mandar al SRI algo que se dio de baja no tiene sentido igual.
  if (factura.anulada) {
    throw new ConflictError("La factura está anulada");
  }
  if (factura.estado === "AUTORIZADO") {
    throw new ConflictError("El SRI ya la autorizó");
  }
  await getOrden(viewer, factura.ordenId);
  await enviarAlSri(factura.contificoDocumentoId);
  return sincronizarFactura(viewer, facturaId);
}

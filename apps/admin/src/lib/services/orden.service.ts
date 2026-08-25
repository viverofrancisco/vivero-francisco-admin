/**
 * Libro de ventas.
 *
 * Una orden es *lo que se vendió*, y existe desde que se hizo el trabajo —
 * antes de que exista factura. Toda la plata vive en `OrdenLinea`, venga de la
 * renovación de una suscripción o de una visita única. Eso hace que un reporte
 * de ventas sea una sola consulta, y que el historial siga siendo del portal
 * aunque algún día se deje de usar Contífico.
 *
 * Las órdenes se generan **a pedido**, no por cron: menos maquinaria, y no hay
 * un proceso que se caiga sin que nadie mire.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { periodosDeSuscripcion, clavePeriodo } from "@/lib/periodos";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

function ensureCanRead(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

/**
 * El cliente tiene que existir y, si quien mira es PERSONAL_ADMIN, caer en
 * alguno de sus sectores. Sin esto se podría facturar a un cliente ajeno
 * mandando su id a mano.
 */
async function ensureClienteVisible(viewer: Viewer, clienteId: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, deletedAt: null },
    select: { id: true, sectorId: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const ids = sectores.map((sa) => sa.sectorId);
    if (!cliente.sectorId || !ids.includes(cliente.sectorId)) {
      throw new ForbiddenError();
    }
  }
  return cliente;
}

const DEC = (n: Prisma.Decimal | number | null | undefined) =>
  new Prisma.Decimal(n ?? 0);

/** Redondeo a centavos, que es la precisión con la que se factura. */
function centavos(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2);
}

export interface LineaCalculada {
  descripcion: string;
  cantidad: Prisma.Decimal;
  precioUnitario: Prisma.Decimal;
  ivaTasa: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  iva: Prisma.Decimal;
  total: Prisma.Decimal;
}

/** Calcula los importes de una línea a partir de cantidad, precio y tasa. */
export function calcularLinea(
  descripcion: string,
  cantidad: Prisma.Decimal | number,
  precioUnitario: Prisma.Decimal | number,
  ivaTasa: Prisma.Decimal | number | null
): LineaCalculada {
  const cant = DEC(cantidad);
  const precio = DEC(precioUnitario);
  const tasa = DEC(ivaTasa);
  const subtotal = centavos(cant.mul(precio));
  const iva = centavos(subtotal.mul(tasa).div(100));
  return {
    descripcion,
    cantidad: cant,
    precioUnitario: precio,
    ivaTasa: tasa,
    subtotal,
    iva,
    total: centavos(subtotal.add(iva)),
  };
}

// ──────────────────────────────────────────────
// Qué está pendiente de facturar
// ──────────────────────────────────────────────

export interface PendienteVisita {
  tipo: "visita";
  visitaProductoId: string;
  visitaId: string;
  productoId: string;
  descripcion: string;
  fecha: Date;
  precio: Prisma.Decimal;
  ivaTasa: Prisma.Decimal;
}

export interface PendienteSuscripcion {
  tipo: "suscripcion";
  suscripcionItemId: string;
  productoId: string;
  descripcion: string;
  periodoInicio: Date;
  periodoFin: Date;
  precio: Prisma.Decimal;
  ivaTasa: Prisma.Decimal;
}

export type Pendiente = PendienteVisita | PendienteSuscripcion;

/**
 * Trabajo por facturar, entre dos fechas.
 *
 * Dos orígenes:
 * - visitas del cliente que no están canceladas y no llevan plan;
 * - suscripciones activas, una línea por período del rango.
 *
 * **Se factura también lo agendado, no solo lo hecho.** Cobrar por adelantado es
 * normal acá, y exigir que la visita estuviera completada dejaba sin salida al
 * caso de facturar antes de ir. Lo único que nunca entra es una visita
 * cancelada: ahí no hay trabajo que cobrar. La contracara es que se puede
 * facturar algo que después no se hace; si eso pasa, se anula la orden.
 *
 * Lo que ya tiene línea de orden no vuelve a aparecer. Eso lo garantizan los
 * índices únicos de `OrdenLinea` (`visitaProductoId` y
 * `suscripcionItemId + periodoInicio`), no solo este filtro.
 */
export async function listarPendientes(
  viewer: Viewer,
  clienteId: string,
  desde: Date,
  hasta: Date,
  /**
   * Tope solo para las visitas. Sirve para llegar desde una visita futura sin
   * ofrecer de paso períodos de suscripción que todavía no arrancaron —cobrar
   * un período por adelantado tiene que seguir siendo una decisión aparte.
   */
  hastaVisitas: Date = hasta
): Promise<Pendiente[]> {
  ensureCanRead(viewer);

  const [visitaProductos, suscripciones] = await Promise.all([
    prisma.visitaProducto.findMany({
      where: {
        // Sin `suscripcionItemId` = trabajo suelto: hay que cobrarlo aparte.
        suscripcionItemId: null,
        ordenLinea: null, // sin facturar
        visita: {
          clienteId,
          deletedAt: null,
          estado: { not: "CANCELADA" },
          fechaProgramada: { gte: desde, lte: hastaVisitas },
        },
      },
      include: {
        visita: { select: { id: true, fechaProgramada: true } },
        producto: {
          select: { id: true, nombre: true, ivaTasa: true },
        },
      },
      orderBy: { visita: { fechaProgramada: "asc" } },
    }),
    prisma.suscripcionItem.findMany({
      where: {
        suscripcion: { clienteId, estado: "ACTIVO" },
        producto: { deletedAt: null },
      },
      include: {
        producto: { select: { id: true, nombre: true } },
        suscripcion: { select: { periodicidad: true, fechaInicio: true } },
        ordenLineas: { select: { periodoInicio: true } },
      },
    }),
  ]);

  const pendientes: Pendiente[] = visitaProductos.map((vp) => ({
    tipo: "visita" as const,
    visitaProductoId: vp.id,
    visitaId: vp.visita.id,
    productoId: vp.producto.id,
    descripcion: vp.producto.nombre,
    fecha: vp.visita.fechaProgramada,
    // El trabajo suelto se cotiza al facturarlo: la visita ya no lleva precio.
    // El IVA sale del catálogo como sugerencia; se puede cambiar en la orden.
    precio: DEC(0),
    ivaTasa: DEC(vp.producto.ivaTasa),
  }));

  // Un período de cobro por cada uno que toque el rango.
  for (const cs of suscripciones) {
    const yaFacturados = new Set(
      cs.ordenLineas
        .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
        .filter(Boolean) as string[]
    );

    for (const { inicio, fin } of periodosDeSuscripcion(
      cs.suscripcion.fechaInicio,
      cs.suscripcion.periodicidad,
      hasta
    )) {
      // Solo entran los períodos que se solapan con el rango pedido.
      if (fin < desde || inicio > hasta) continue;
      if (yaFacturados.has(clavePeriodo(inicio))) continue;
      pendientes.push({
        tipo: "suscripcion",
        suscripcionItemId: cs.id,
        productoId: cs.producto.id,
        descripcion: cs.producto.nombre,
        periodoInicio: inicio,
        periodoFin: fin,
        precio: DEC(cs.precio),
        ivaTasa: DEC(cs.ivaTasa),
      });
    }
  }

  return pendientes;
}

// ──────────────────────────────────────────────
// Crear la orden
// ──────────────────────────────────────────────

/**
 * Una línea tal como la arma quien crea la orden.
 *
 * `descripcion` y `precioUnitario` son la verdad: el catálogo solo prellena el
 * formulario. `productoId` y la procedencia (`visitaProductoId` o
 * `suscripcionItemId` + período) son para reportes y para que nada se facture
 * dos veces; nunca son la fuente del precio.
 */
export interface LineaOrdenInput {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
  /** Obligatorio: Contífico no acepta líneas sin producto. */
  productoId: string;
  visitaProductoId?: string | null;
  suscripcionItemId?: string | null;
  periodoInicio?: Date | null;
  periodoFin?: Date | null;
}

export interface CrearOrdenPayload {
  clienteId: string;
  fecha?: Date;
  notas?: string | null;
  /** Con qué facturar. Si no viene, al emitir se usa el predeterminado. */
  datoFacturacionId?: string | null;
  lineas: LineaOrdenInput[];
}

/**
 * Crea una orden en BORRADOR con las líneas que le pasen.
 *
 * Es el único escritor de órdenes: `generarOrden` (que arma las líneas desde
 * lo pendiente) termina acá. Las líneas con procedencia se validan contra el
 * cliente de la orden — si no, mandando un id a mano se podría facturar el
 * trabajo de otro cliente.
 */
export async function crearOrden(viewer: Viewer, payload: CrearOrdenPayload) {
  ensureCanWrite(viewer);
  await ensureClienteVisible(viewer, payload.clienteId);

  // Las mismas reglas que al editar: una sola función, para que no se separen.
  await validarLineas(payload.clienteId, payload.lineas);
  await ensureDatoDelCliente(payload.clienteId, payload.datoFacturacionId);

  const { lineas, subtotal, iva } = armarLineas(payload.lineas);

  try {
    return await prisma.orden.create({
      data: {
        clienteId: payload.clienteId,
        datoFacturacionId: payload.datoFacturacionId ?? null,
        fecha: payload.fecha ?? new Date(),
        estado: "BORRADOR",
        notas: payload.notas?.trim() || null,
        subtotal,
        iva,
        total: centavos(subtotal.add(iva)),
        createdById: viewer.id,
        updatedById: viewer.id,
        lineas: { create: lineas },
      },
      include: { lineas: { orderBy: { posicion: "asc" } } },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "Parte de ese trabajo ya está en otra orden. Volvé a armarla."
      );
    }
    throw error;
  }
}

/**
 * Los datos de facturación tienen que ser del mismo cliente que la orden. Si no,
 * se le facturaría a alguien con la razón social de otro.
 */
async function ensureDatoDelCliente(
  clienteId: string,
  datoFacturacionId?: string | null
): Promise<void> {
  if (!datoFacturacionId) return;
  const dato = await prisma.datoFacturacion.findUnique({
    where: { id: datoFacturacionId },
    select: { clienteId: true },
  });
  if (!dato || dato.clienteId !== clienteId) {
    throw new ValidationError(
      "Esos datos de facturación no son de este cliente."
    );
  }
}

/** Calcula las líneas persistibles y los totales de la orden. */
function armarLineas(entrada: LineaOrdenInput[]) {
  const lineas = entrada.map((l, idx) => ({
    posicion: idx,
    ...calcularLinea(
      l.descripcion.trim(),
      l.cantidad,
      l.precioUnitario,
      l.ivaTasa
    ),
    productoId: l.productoId,
    visitaProductoId: l.visitaProductoId ?? null,
    suscripcionItemId: l.suscripcionItemId ?? null,
    periodoInicio: l.periodoInicio ?? null,
    periodoFin: l.periodoFin ?? null,
  }));

  const subtotal = centavos(
    lineas.reduce((acc, l) => acc.add(l.subtotal), new Prisma.Decimal(0))
  );
  const iva = centavos(
    lineas.reduce((acc, l) => acc.add(l.iva), new Prisma.Decimal(0))
  );
  return { lineas, subtotal, iva };
}

/** Las mismas reglas que al crear: nada entra por la puerta de atrás. */
async function validarLineas(
  clienteId: string,
  lineas: LineaOrdenInput[]
): Promise<void> {
  if (lineas.length === 0) {
    throw new ValidationError("La orden necesita al menos un producto.");
  }
  for (const l of lineas) {
    if (!l.descripcion.trim()) {
      throw new ValidationError("Cada producto necesita una descripción.");
    }
    if (!(l.cantidad > 0)) {
      throw new ValidationError(
        `La cantidad de "${l.descripcion}" tiene que ser mayor a 0.`
      );
    }
    if (!(l.precioUnitario >= 0)) {
      throw new ValidationError(
        `El precio de "${l.descripcion}" no puede ser negativo.`
      );
    }
    if (l.ivaTasa < 0 || l.ivaTasa > 100) {
      throw new ValidationError(
        `El IVA de "${l.descripcion}" tiene que estar entre 0 y 100.`
      );
    }
    if (l.suscripcionItemId && !l.periodoInicio) {
      throw new ValidationError(
        `"${l.descripcion}" viene de una suscripción y necesita período.`
      );
    }
    // Sin producto del catálogo la línea no se puede facturar: Contífico exige
    // `producto_id` en cada `detalles[]` y no acepta texto libre. Se corta acá
    // y no al emitir, para no dejar armada una orden que no se va a poder
    // cobrar.
    if (!l.productoId) {
      throw new ValidationError(
        `"${l.descripcion}" no está vinculada a un producto del catálogo. Creá el producto y agregalo desde ahí.`
      );
    }
  }
  await ensureProcedenciaDelCliente(clienteId, lineas);
  await ensureProductosVendibles(clienteId, lineas);
}

export interface ActualizarOrdenPayload {
  /**
   * Cambiar de cliente en un borrador. Todo lo que dependa del anterior —las
   * líneas con procedencia y los datos de facturación— se valida contra el
   * nuevo, así que si algo no le corresponde el cambio se rechaza entero.
   */
  clienteId?: string;
  fecha?: Date;
  notas?: string | null;
  datoFacturacionId?: string | null;
  /** Si viene, reemplaza el conjunto completo de líneas. */
  lineas?: LineaOrdenInput[];
}

/**
 * Edita una orden que todavía está en BORRADOR.
 *
 * Solo el borrador se toca: una vez confirmada, la orden es lo que se le va a
 * facturar al cliente, y una vez facturada Contífico no deja editarla ni
 * anularla por API. Mover el número hacia atrás sería mentirle al historial.
 */
export async function actualizarOrden(
  viewer: Viewer,
  id: string,
  payload: ActualizarOrdenPayload
) {
  ensureCanWrite(viewer);
  const actual = await getOrden(viewer, id);
  if (actual.estado !== "BORRADOR") {
    throw new ConflictError(
      `Esta orden está ${actual.estado.toLowerCase()}: solo se puede editar un borrador.`
    );
  }

  // Todo se valida contra el cliente que va a quedar, no contra el que había.
  const clienteId = payload.clienteId ?? actual.clienteId;
  if (payload.clienteId && payload.clienteId !== actual.clienteId) {
    await ensureClienteVisible(viewer, payload.clienteId);
    // Las líneas que no se reemplazan siguen apuntando al cliente viejo.
    if (!payload.lineas) {
      const conProcedencia = actual.lineas.filter(
        (l) => l.visitaProductoId || l.suscripcionItemId
      );
      if (conProcedencia.length > 0) {
        throw new ValidationError(
          "Esta orden tiene productos que vienen del trabajo del cliente anterior. Quitalos antes de cambiar de cliente."
        );
      }
    }
  }
  if (payload.lineas) {
    await validarLineas(clienteId, payload.lineas);
  }

  // Si lo mandan explícito, tiene que ser del cliente que queda: pasar uno
  // ajeno es un error y se avisa.
  if (payload.datoFacturacionId !== undefined) {
    await ensureDatoDelCliente(clienteId, payload.datoFacturacionId);
  }

  // Y si cambió el cliente sin tocar la facturación, la que había era del
  // anterior: se limpia. Dejarla sería emitirle al nuevo con la razón social
  // del viejo, que es el error más caro que puede cometer esta pantalla.
  let limpiarDato = false;
  if (
    payload.clienteId &&
    payload.clienteId !== actual.clienteId &&
    payload.datoFacturacionId === undefined &&
    actual.datoFacturacionId
  ) {
    limpiarDato = true;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      let totales: { subtotal: Prisma.Decimal; iva: Prisma.Decimal } | null =
        null;

      if (payload.lineas) {
        const armadas = armarLineas(payload.lineas);
        totales = { subtotal: armadas.subtotal, iva: armadas.iva };
        // Se reemplaza el conjunto entero: las procedencias liberadas vuelven a
        // aparecer como pendientes, que es justo lo que se espera al sacar una
        // línea de un borrador.
        await tx.ordenLinea.deleteMany({ where: { ordenId: id } });
        await tx.ordenLinea.createMany({
          data: armadas.lineas.map((l) => ({ ...l, ordenId: id })),
        });
      }

      return tx.orden.update({
        where: { id },
        data: {
          ...(payload.clienteId ? { clienteId: payload.clienteId } : {}),
          ...(payload.fecha ? { fecha: payload.fecha } : {}),
          ...(payload.notas !== undefined
            ? { notas: payload.notas?.trim() || null }
            : {}),
          ...(payload.datoFacturacionId !== undefined
            ? { datoFacturacionId: payload.datoFacturacionId }
            : limpiarDato
              ? { datoFacturacionId: null }
              : {}),
          ...(totales
            ? {
                subtotal: totales.subtotal,
                iva: totales.iva,
                total: centavos(totales.subtotal.add(totales.iva)),
              }
            : {}),
          updatedById: viewer.id,
        },
        include: { lineas: { orderBy: { posicion: "asc" } } },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "Parte de ese trabajo ya está en otra orden. Revisá los productos."
      );
    }
    throw error;
  }
}

/**
 * Qué puede entrar en una orden: producto vinculado a Contífico, y nada que ya
 * cubra una suscripción de este cliente sin decir de dónde viene.
 *
 * El bloqueo va acá y no al facturar: si la orden ya existe, el trabajo ya se
 * hizo y descubrir recién ahí que no se puede emitir no le sirve a nadie. Con
 * esta regla, además, ninguna orden puede llegar a facturación con productos
 * sin sincronizar.
 */
async function ensureProductosVendibles(
  clienteId: string,
  lineas: LineaOrdenInput[]
): Promise<void> {
  const ids = [
    ...new Set(lineas.map((l) => l.productoId).filter((id): id is string => !!id)),
  ];
  if (ids.length === 0) return;

  const productos = await prisma.producto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, contificoProductoId: true },
  });

  const sinVincular = productos.filter((p) => !p.contificoProductoId);
  if (sinVincular.length > 0) {
    const nombres = sinVincular.map((p) => `"${p.nombre}"`).join(", ");
    throw new ValidationError(
      `${nombres} ${sinVincular.length === 1 ? "no está sincronizado" : "no están sincronizados"} con Contífico. Vinculá el producto desde su ficha antes de venderlo.`
    );
  }

  // Lo que este cliente tiene bajo suscripción necesita **procedencia**: o el
  // período que lo cubre (`suscripcionItemId`) o la visita concreta que lo
  // ejecutó (`visitaProductoId`). Lo segundo es legítimo: una visita de más que
  // se hizo igual y se cobra aparte.
  //
  // Lo que no se puede es agregarlo a mano del catálogo: esa línea no chocaría
  // contra ningún índice único, así que el mismo trabajo se podría facturar dos
  // veces —una a mano y otra desde lo pendiente— sin que nada lo impida.
  //
  // Se pregunta por cliente y no por una etiqueta del catálogo: el producto no
  // es recurrente en abstracto, lo es para quien lo tiene contratado.
  const suscritos = new Set(
    (
      await prisma.suscripcionItem.findMany({
        where: {
          productoId: { in: ids },
          suscripcion: { clienteId, estado: "ACTIVO" },
        },
        select: { productoId: true },
      })
    ).map((i) => i.productoId)
  );

  const porId = new Map(productos.map((p) => [p.id, p]));
  const cubiertoSinOrigen = lineas.find(
    (l) =>
      l.productoId &&
      suscritos.has(l.productoId) &&
      !l.suscripcionItemId &&
      !l.visitaProductoId
  );
  if (cubiertoSinOrigen) {
    const nombre = porId.get(cubiertoSinOrigen.productoId!)!.nombre;
    throw new ValidationError(
      `"${nombre}" está en una suscripción activa de este cliente: entra desde "Pendiente de facturar" —como período o como visita— y no agregándolo a mano del catálogo.`
    );
  }
}

/**
 * Toda procedencia tiene que ser del mismo cliente que la orden. Es lo que
 * impide facturarle a alguien el trabajo de otro pasando un id a mano.
 */
async function ensureProcedenciaDelCliente(
  clienteId: string,
  lineas: LineaOrdenInput[]
): Promise<void> {
  const visitaProductoIds = lineas
    .map((l) => l.visitaProductoId)
    .filter((id): id is string => !!id);
  const suscripcionItemIds = lineas
    .map((l) => l.suscripcionItemId)
    .filter((id): id is string => !!id);

  if (visitaProductoIds.length > 0) {
    const validos = await prisma.visitaProducto.count({
      where: {
        id: { in: visitaProductoIds },
        visita: { clienteId, deletedAt: null },
      },
    });
    if (validos !== new Set(visitaProductoIds).size) {
      throw new ValidationError(
        "Alguno de los productos apunta a un trabajo que no es de este cliente."
      );
    }
  }

  if (suscripcionItemIds.length > 0) {
    const validos = await prisma.suscripcionItem.count({
      where: { id: { in: suscripcionItemIds }, suscripcion: { clienteId } },
    });
    if (validos !== new Set(suscripcionItemIds).size) {
      throw new ValidationError(
        "Alguno de los productos apunta a una suscripción que no es de este cliente."
      );
    }
  }
}

export interface GenerarOrdenPayload {
  clienteId: string;
  desde: Date;
  hasta: Date;
  fecha?: Date;
  notas?: string | null;
}

/**
 * Arma una orden en BORRADOR con todo lo pendiente del rango.
 *
 * Es idempotente por construcción: si algo ya está en otra orden, los índices
 * únicos de `OrdenLinea` lo rechazan aunque dos personas generen a la vez.
 */
export async function generarOrden(
  viewer: Viewer,
  payload: GenerarOrdenPayload
) {
  ensureCanWrite(viewer);
  await ensureClienteVisible(viewer, payload.clienteId);

  const pendientes = await listarPendientes(
    viewer,
    payload.clienteId,
    payload.desde,
    payload.hasta
  );
  if (pendientes.length === 0) {
    throw new ValidationError("No hay nada pendiente de facturar en ese rango.");
  }

  return crearOrden(viewer, {
    clienteId: payload.clienteId,
    fecha: payload.fecha,
    notas: payload.notas,
    lineas: pendientes.map(lineaDesdePendiente),
  });
}

/** Traduce algo pendiente a la línea de orden que lo representa. */
export function lineaDesdePendiente(p: Pendiente): LineaOrdenInput {
  const base = {
    descripcion: p.descripcion,
    cantidad: 1,
    precioUnitario: Number(p.precio),
    ivaTasa: Number(p.ivaTasa),
    productoId: p.productoId,
  };
  return p.tipo === "visita"
    ? { ...base, visitaProductoId: p.visitaProductoId }
    : {
        ...base,
        suscripcionItemId: p.suscripcionItemId,
        periodoInicio: p.periodoInicio,
        periodoFin: p.periodoFin,
      };
}

// ──────────────────────────────────────────────
// Qué falta cobrar, en todo el negocio
// ──────────────────────────────────────────────

export interface OrdenPorCobrar {
  id: string;
  numero: number;
  fecha: Date;
  total: number;
  productos: number;
  factura: {
    numero: string;
    estado: string;
    fechaEmision: Date;
    saldo: number;
    /** `false` si nunca se sincronizó: el saldo es una suposición. */
    sincronizada: boolean;
  };
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
}

/**
 * Órdenes facturadas a las que todavía les falta cobrar.
 *
 * Una fila por orden, no por cliente: la deuda **es** una factura concreta con
 * su número, no un total que alguien tenga que desglosar después.
 *
 * Antes acá vivían las órdenes por facturar. Dejó de tener sentido cuando
 * confirmar pasó a emitir: lo que queda sin factura es un borrador, y un
 * borrador es trabajo por aprobar, no plata por entrar.
 */
export async function listarOrdenesPorCobrar(
  viewer: Viewer
): Promise<OrdenPorCobrar[]> {
  ensureCanRead(viewer);

  // Facturada y con saldo. Un `saldo` en `null` es una factura que nunca se
  // sincronizó: entra igual, porque no saber cuánto falta no es lo mismo que
  // saber que no falta nada.
  const where: Prisma.OrdenWhereInput = {
    estado: "CONFIRMADA",
    facturas: {
      some: { anulada: false, OR: [{ saldo: null }, { saldo: { gt: 0 } }] },
    },
    cliente: { deletedAt: null },
  };
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    where.cliente = {
      deletedAt: null,
      sectorId: { in: sectores.map((s) => s.sectorId) },
    };
  }

  const ordenes = await prisma.orden.findMany({
    where,
    select: {
      id: true,
      numero: true,
      fecha: true,
      total: true,
      _count: { select: { lineas: true } },
      facturas: {
        where: { anulada: false },
        select: { numero: true, estado: true, saldo: true, fechaEmision: true },
        take: 1,
      },
      cliente: {
        select: { id: true, nombre: true, apellido: true, empresa: true },
      },
    },
    orderBy: { fecha: "asc" },
  });

  return ordenes.map((o) => {
    const f = o.facturas[0];
    return {
      id: o.id,
      numero: o.numero,
      fecha: o.fecha,
      total: Number(o.total),
      productos: o._count.lineas,
      factura: {
        numero: f.numero,
        estado: f.estado,
        fechaEmision: f.fechaEmision,
        // Sin sincronizar se asume todo pendiente: es el número prudente.
        saldo: f.saldo === null ? Number(o.total) : Number(f.saldo),
        sincronizada: f.saldo !== null,
      },
      cliente: o.cliente,
    };
  });
}

/**
 * Cuántos borradores esperan que alguien los revise.
 *
 * Los crea el cron de renovaciones y no se facturan solos: la decisión de
 * cobrar sigue siendo de una persona. Se cuentan para que la salida del cron no
 * quede invisible.
 */
export async function borradoresSinConfirmar(viewer: Viewer): Promise<number> {
  ensureCanRead(viewer);
  const where: Prisma.OrdenWhereInput = {
    estado: "BORRADOR",
    cliente: { deletedAt: null },
  };
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    where.cliente = {
      deletedAt: null,
      sectorId: { in: sectores.map((s) => s.sectorId) },
    };
  }
  return prisma.orden.count({ where });
}



/**
 * Períodos de suscripción vencidos que **no** tienen orden.
 *
 * En condiciones normales esto es cero: el cron los crea todos los días. Si no
 * lo es, algo falló — el cron no corrió, o la suscripción tiene un producto sin
 * vincular a Contífico y se omitió a propósito.
 *
 * Es la red de seguridad de que el cobro no dependa de que un proceso invisible
 * haya funcionado. Sin esto, un cron caído se descubre cuando el cliente
 * pregunta por qué no le llegó la factura.
 */
/**
 * Períodos vencidos sin orden, **desglosados por suscripción**.
 *
 * El desglose es lo que permite hacer algo con el dato: el resumen suelto decía
 * "faltan 52 períodos" sin nombrar ninguno, y generar a ciegas desde ahí no es
 * una decisión, es un salto de fe.
 */
export async function periodosSinOrdenPorSuscripcion(
  viewer: Viewer
): Promise<Map<string, { cantidad: number; total: number }>> {
  ensureCanRead(viewer);

  const suscripciones = await prisma.suscripcion.findMany({
    where: { estado: "ACTIVO", cliente: { deletedAt: null } },
    select: {
      id: true,
      periodicidad: true,
      fechaInicio: true,
      items: {
        select: {
          precio: true,
          ivaTasa: true,
          producto: { select: { deletedAt: true } },
          ordenLineas: { select: { periodoInicio: true } },
        },
      },
    },
  });

  const hasta = new Date();
  const porSuscripcion = new Map<string, { cantidad: number; total: number }>();

  for (const sus of suscripciones) {
    let cantidad = 0;
    let total = 0;
    for (const item of sus.items) {
      if (item.producto.deletedAt) continue;
      const facturados = new Set(
        item.ordenLineas
          .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
          .filter(Boolean) as string[]
      );
      for (const { inicio } of periodosDeSuscripcion(
        sus.fechaInicio,
        sus.periodicidad,
        hasta
      )) {
        if (facturados.has(clavePeriodo(inicio))) continue;
        cantidad++;
        total += Number(item.precio) * (1 + Number(item.ivaTasa) / 100);
      }
    }
    if (cantidad > 0) {
      porSuscripcion.set(sus.id, {
        cantidad,
        total: Math.round(total * 100) / 100,
      });
    }
  }

  return porSuscripcion;
}

/** El resumen de lo anterior, para el aviso de "Por facturar". */
export async function periodosSinOrden(viewer: Viewer): Promise<{
  cantidad: number;
  total: number;
  suscripciones: number;
}> {
  const detalle = await periodosSinOrdenPorSuscripcion(viewer);
  let cantidad = 0;
  let total = 0;
  for (const d of detalle.values()) {
    cantidad += d.cantidad;
    total += d.total;
  }
  return {
    cantidad,
    total: Math.round(total * 100) / 100,
    suscripciones: detalle.size,
  };
}

// ──────────────────────────────────────────────
// Renovaciones automáticas
// ──────────────────────────────────────────────

export interface ResultadoRenovaciones {
  creadas: { ordenId: string; numero: number; clienteId: string; periodo: string }[];
  omitidas: { suscripcionId: string; motivo: string }[];
}

/**
 * Crea en BORRADOR las órdenes de los períodos de suscripción ya vencidos.
 *
 * Corre desde el cron, sin viewer: es un proceso del sistema, no de una
 * persona. Por eso deja todo en borrador — la decisión de cobrar sigue siendo
 * humana, y hasta confirmarla se puede ajustar el precio o sumarle un adicional.
 *
 * Es **idempotente**: los períodos que ya tienen línea de orden se saltean, y si
 * dos corridas se pisaran el índice único `[suscripcionItemId, periodoInicio]`
 * rechaza la segunda. Correrlo de más no rompe nada.
 *
 * Una orden por suscripción y período, con todos sus ítems adentro: la
 * periodicidad es del contrato, así que todo lo que contiene se cobra junto.
 */
export async function generarRenovaciones(
  hasta: Date = new Date()
): Promise<ResultadoRenovaciones> {
  const resultado: ResultadoRenovaciones = { creadas: [], omitidas: [] };

  const suscripciones = await prisma.suscripcion.findMany({
    where: { estado: "ACTIVO", cliente: { deletedAt: null } },
    select: {
      id: true,
      clienteId: true,
      periodicidad: true,
      fechaInicio: true,
      items: {
        select: {
          id: true,
          precio: true,
          ivaTasa: true,
          producto: {
            select: {
              id: true,
              nombre: true,
              deletedAt: true,
              contificoProductoId: true,
            },
          },
          ordenLineas: { select: { periodoInicio: true } },
        },
      },
    },
  });

  for (const sus of suscripciones) {
    const activos = sus.items.filter((i) => i.producto.deletedAt === null);
    if (activos.length === 0) {
      resultado.omitidas.push({
        suscripcionId: sus.id,
        motivo: "sin productos activos",
      });
      continue;
    }
    // Un producto desvinculado después de armar la suscripción no se puede
    // facturar. Se saltea la suscripción entera y se reporta, en vez de generar
    // una orden que después no va a poder emitirse.
    const sinVincular = activos.filter((i) => !i.producto.contificoProductoId);
    if (sinVincular.length > 0) {
      resultado.omitidas.push({
        suscripcionId: sus.id,
        motivo: `sin vincular con Contífico: ${sinVincular.map((i) => i.producto.nombre).join(", ")}`,
      });
      continue;
    }

    const facturadosPorItem = new Map(
      activos.map((i) => [
        i.id,
        new Set(
          i.ordenLineas
            .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
            .filter(Boolean) as string[]
        ),
      ])
    );

    for (const { inicio, fin } of periodosDeSuscripcion(
      sus.fechaInicio,
      sus.periodicidad,
      hasta
    )) {
      const clave = clavePeriodo(inicio);
      // Solo los ítems que todavía no tienen ese período facturado. Si uno se
      // agregó a la suscripción después, se pone al día sin duplicar los otros.
      const aFacturar = activos.filter(
        (i) => !facturadosPorItem.get(i.id)!.has(clave)
      );
      if (aFacturar.length === 0) continue;

      const { lineas, subtotal, iva } = armarLineas(
        aFacturar.map((i) => ({
          descripcion: i.producto.nombre,
          cantidad: 1,
          precioUnitario: Number(i.precio),
          ivaTasa: Number(i.ivaTasa),
          productoId: i.producto.id,
          suscripcionItemId: i.id,
          periodoInicio: inicio,
          periodoFin: fin,
        }))
      );

      try {
        const orden = await prisma.orden.create({
          data: {
            clienteId: sus.clienteId,
            fecha: new Date(),
            estado: "BORRADOR",
            subtotal,
            iva,
            total: centavos(subtotal.add(iva)),
            lineas: { create: lineas },
          },
          select: { id: true, numero: true },
        });
        resultado.creadas.push({
          ordenId: orden.id,
          numero: orden.numero,
          clienteId: sus.clienteId,
          periodo: clave,
        });
      } catch (error) {
        // Otra corrida ganó la carrera: el índice único hizo su trabajo.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  return resultado;
}

// ──────────────────────────────────────────────
// Consulta y transiciones
// ──────────────────────────────────────────────

export async function listarOrdenes(
  viewer: Viewer,
  options: {
    clienteId?: string;
    estado?: string;
    /** Varios estados a la vez; gana sobre `estado` si vienen los dos. */
    estados?: string[];
    limit?: number;
    offset?: number;
  } = {}
) {
  ensureCanRead(viewer);
  const where: Prisma.OrdenWhereInput = {};
  if (options.clienteId) where.clienteId = options.clienteId;
  if (options.estados?.length) where.estado = { in: options.estados as never[] };
  else if (options.estado) where.estado = options.estado as never;
  // PERSONAL_ADMIN solo ve los clientes de sus sectores.
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    where.cliente = { sectorId: { in: sectores.map((s) => s.sectorId) } };
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(0, options.offset ?? 0);
  const [items, total] = await Promise.all([
    prisma.orden.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
        _count: { select: { lineas: true, facturas: true } },
        // La factura viva, para poder decir si está cobrada. El estado de la
        // orden no lo sabe: cobrar es otro eje.
        facturas: {
          where: { anulada: false },
          select: { saldo: true },
          take: 1,
        },
      },
      orderBy: { fecha: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.orden.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function getOrden(viewer: Viewer, id: string) {
  ensureCanRead(viewer);
  const orden = await prisma.orden.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          id: true, nombre: true, apellido: true, empresa: true,
          cedula: true, ruc: true, tipoPersona: true,
          direccion: true, telefono: true, email: true, sectorId: true,
        },
      },
      lineas: {
        orderBy: { posicion: "asc" },
        include: {
          producto: true,
          // De qué visita salió la línea: sin esto la orden dice "trabajo de una
          // visita" y no hay forma de saber cuál.
          visitaProducto: {
            select: {
              visita: { select: { id: true, fechaProgramada: true } },
            },
          },
        },
      },
      facturas: {
        orderBy: { createdAt: "desc" },
        include: {
          datoFacturacion: {
            select: {
              tipoIdentificacion: true,
              tipoPersona: true,
              direccion: true,
              telefono: true,
              email: true,
            },
          },
        },
      },
    },
  });
  if (!orden) throw new NotFoundError("Orden no encontrada");
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const ids = sectores.map((s) => s.sectorId);
    if (!orden.cliente.sectorId || !ids.includes(orden.cliente.sectorId)) {
      throw new ForbiddenError();
    }
  }
  return orden;
}

/** Una orden confirmada es la que está lista para facturar. */
/**
 * Suelta el trabajo que la orden tenía reservado.
 *
 * `visitaProductoId` y `[suscripcionItemId, periodoInicio]` son únicos **en toda
 * la tabla**, sin mirar el estado de la orden, y `listarPendientes` da por
 * facturado cualquier trabajo que tenga línea. Sin esto, anular una orden se
 * comía sus visitas y sus períodos para siempre: no volvían a aparecer como
 * pendientes ni se podían meter en otra orden.
 *
 * Se pierde el vínculo, no el historial: `descripcion` y `precioUnitario` son
 * la verdad de la línea y quedan intactos, así que la orden anulada sigue
 * diciendo qué contenía.
 */
export async function liberarProcedencia(
  tx: Prisma.TransactionClient,
  ordenId: string
) {
  await tx.ordenLinea.updateMany({
    where: { ordenId },
    data: { visitaProductoId: null, suscripcionItemId: null, periodoInicio: null },
  });
}

/**
 * Anular es el final del camino de una orden: no se reabre ni se vuelve a
 * facturar. Para volver a cobrar ese trabajo se arma una orden nueva.
 *
 * **No se anula una orden con trabajo enlazado sin decirlo.** Una visita o un
 * período que se van con la orden no vuelven nunca: los índices únicos de
 * procedencia no miran el estado, así que ese trabajo quedaría reservado por
 * una orden muerta, invisible en "pendientes" e imposible de meter en otra.
 * Por eso hay que pedirlo con `liberarTrabajo`, después de ver la lista.
 *
 * Una orden **facturada** no se anula por acá: primero va su factura, y de eso
 * se ocupa `anularOrdenCompleta` en `factura.service`.
 */
export async function anularOrden(
  viewer: Viewer,
  id: string,
  opciones: { liberarTrabajo?: boolean } = {}
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, id);
  if (orden.estado === "CONFIRMADA") {
    throw new ConflictError(
      "Esta orden ya tiene factura. Hay que anular la factura primero."
    );
  }

  const enlazado = orden.lineas.filter(
    (l) => l.visitaProductoId || l.suscripcionItemId
  );
  if (enlazado.length > 0 && !opciones.liberarTrabajo) {
    throw new ConflictError(
      `Esta orden tiene ${enlazado.length} ${enlazado.length === 1 ? "línea enlazada" : "líneas enlazadas"} a una visita o a una suscripción. Hay que desenlazarlas antes de anular, o vuelven a quedar sin poder facturarse.`
    );
  }

  return prisma.$transaction(async (tx) => {
    await liberarProcedencia(tx, id);
    return tx.orden.update({
      where: { id },
      data: { estado: "ANULADA", updatedById: viewer.id },
    });
  });
}

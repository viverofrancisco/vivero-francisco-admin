/**
 * Suscripciones: lo recurrente que un cliente tiene contratado.
 *
 * Una suscripción agrupa uno o más productos que se cobran juntos en el mismo
 * ciclo. Cada renovación genera una orden con **una línea por ítem**, y esa
 * orden se emite en Contífico como un documento con N `detalles` — por eso la
 * tasa de IVA vive en el ítem y no en la cabecera: una misma factura puede
 * mezclar líneas al 0% y al 15%.
 *
 * Los trabajos sueltos (productos `UNICO`) no pasan por acá: se cotizan en la
 * visita, que guarda su propio precio.
 */
import { Prisma } from "@/generated/prisma/client";
import type { EstadoServicio, Periodicidad } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

/** `true` si el error de Prisma es una FK con `onDelete: Restrict`. */
export function isForeignKeyRestriction(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

export interface ItemInput {
  productoId: string;
  precio: number;
  ivaTasa?: number | null;
  visitasPorPeriodo?: number | null;
}

/**
 * Un producto recurrente declara cuántas visitas incluye por período. La
 * regla estaba duplicada en cada formulario; acá es una sola.
 */
async function validarItems(items: ItemInput[]): Promise<void> {
  if (items.length === 0) {
    throw new ValidationError("La suscripción necesita al menos un producto.");
  }
  const ids = [...new Set(items.map((i) => i.productoId))];
  if (ids.length !== items.length) {
    throw new ValidationError("Hay un producto repetido en la suscripción.");
  }
  const productos = await prisma.producto.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, nombre: true, contificoProductoId: true },
  });
  if (productos.length !== ids.length) {
    throw new ValidationError("Alguno de los productos no existe.");
  }
  // Una suscripción va a generar órdenes, y una orden no admite productos sin
  // vincular. Rechazarlo acá evita armar una suscripción que después no se puede
  // cobrar.
  const sinVincular = productos.find((p) => !p.contificoProductoId);
  if (sinVincular) {
    throw new ValidationError(
      `"${sinVincular.nombre}" no está sincronizado con Contífico. Vinculalo desde la ficha del producto antes de contratarlo.`
    );
  }
  for (const item of items) {
    if (item.precio < 0) throw new ValidationError("El precio no puede ser negativo.");
    if ((item.visitasPorPeriodo ?? 0) < 1) {
      const nombre = productos.find((p) => p.id === item.productoId)?.nombre;
      throw new ValidationError(
        `Indicá las visitas por período de "${nombre}".`
      );
    }
  }
}

export interface CrearSuscripcionPayload {
  clienteId: string;
  periodicidad?: Periodicidad;
  fechaInicio?: Date | string;
  notas?: string | null;
  items: ItemInput[];
}

export async function crearSuscripcion(
  viewer: Viewer,
  payload: CrearSuscripcionPayload
) {
  ensureCanWrite(viewer);

  const cliente = await prisma.cliente.findFirst({
    where: { id: payload.clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  await validarItems(payload.items);

  // Un producto no puede estar en dos suscripciones activas del mismo cliente:
  // se cobraría dos veces el mismo período.
  const yaCubiertos = await prisma.suscripcionItem.findMany({
    where: {
      productoId: { in: payload.items.map((i) => i.productoId) },
      suscripcion: { clienteId: payload.clienteId, estado: "ACTIVO" },
    },
    include: { producto: { select: { nombre: true } } },
  });
  if (yaCubiertos.length > 0) {
    throw new ConflictError(
      `El cliente ya tiene una suscripción activa con "${yaCubiertos[0].producto.nombre}".`
    );
  }

  return prisma.suscripcion.create({
    data: {
      clienteId: payload.clienteId,
      periodicidad: payload.periodicidad ?? "MENSUAL",
      fechaInicio: payload.fechaInicio
        ? new Date(payload.fechaInicio)
        : new Date(),
      notas: payload.notas?.trim() || null,
      createdById: viewer.id,
      updatedById: viewer.id,
      items: {
        create: payload.items.map((i) => ({
          productoId: i.productoId,
          precio: i.precio,
          ivaTasa: i.ivaTasa ?? 0,
          visitasPorPeriodo: i.visitasPorPeriodo ?? null,
        })),
      },
    },
    include: { items: { include: { producto: true } } },
  });
}

export interface ActualizarSuscripcionPayload {
  periodicidad?: Periodicidad;
  estado?: EstadoServicio;
  fechaInicio?: Date | string;
  notas?: string | null;
  /** Si viene, reemplaza el conjunto de ítems. */
  items?: ItemInput[];
}

export async function actualizarSuscripcion(
  viewer: Viewer,
  suscripcionId: string,
  payload: ActualizarSuscripcionPayload
) {
  ensureCanWrite(viewer);

  const actual = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
    select: { id: true, clienteId: true },
  });
  if (!actual) throw new NotFoundError("Suscripción no encontrada");

  if (payload.items) {
    await validarItems(payload.items);
    // Un producto que ya está en ESTA suscripción no choca consigo mismo.
    const enOtra = await prisma.suscripcionItem.findMany({
      where: {
        productoId: { in: payload.items.map((i) => i.productoId) },
        suscripcion: {
          clienteId: actual.clienteId,
          estado: "ACTIVO",
          id: { not: suscripcionId },
        },
      },
      include: { producto: { select: { nombre: true } } },
    });
    if (enOtra.length > 0) {
      throw new ConflictError(
        `El cliente ya tiene otra suscripción activa con "${enOtra[0].producto.nombre}".`
      );
    }
  }

  const items = payload.items;
  return prisma.$transaction(async (tx) => {
    if (items) {
      const ids = items.map((i) => i.productoId);
      // Las visitas que apuntaban a un ítem que se quita quedan sin cobertura;
      // el trabajo ya hecho no se borra, solo deja de estar cubierto.
      await tx.visitaProducto.updateMany({
        where: {
          suscripcionItem: { suscripcionId, productoId: { notIn: ids } },
        },
        data: { suscripcionItemId: null },
      });
      await tx.suscripcionItem.deleteMany({
        where: { suscripcionId, productoId: { notIn: ids } },
      });
      for (const i of items) {
        await tx.suscripcionItem.upsert({
          where: {
            suscripcionId_productoId: { suscripcionId, productoId: i.productoId },
          },
          create: {
            suscripcionId,
            productoId: i.productoId,
            precio: i.precio,
            ivaTasa: i.ivaTasa ?? 0,
            visitasPorPeriodo: i.visitasPorPeriodo ?? null,
          },
          update: {
            precio: i.precio,
            ivaTasa: i.ivaTasa ?? 0,
            visitasPorPeriodo: i.visitasPorPeriodo ?? null,
          },
        });
      }
    }
    return tx.suscripcion.update({
      where: { id: suscripcionId },
      data: {
        ...(payload.periodicidad ? { periodicidad: payload.periodicidad } : {}),
        ...(payload.estado ? { estado: payload.estado } : {}),
        ...(payload.fechaInicio
          ? { fechaInicio: new Date(payload.fechaInicio) }
          : {}),
        ...(payload.notas !== undefined
          ? { notas: payload.notas?.trim() || null }
          : {}),
        updatedById: viewer.id,
      },
      include: { items: { include: { producto: true } } },
    });
  });
}

export async function cambiarEstadoSuscripcion(
  viewer: Viewer,
  suscripcionId: string,
  estado: EstadoServicio
) {
  ensureCanWrite(viewer);
  const existe = await prisma.suscripcion.count({ where: { id: suscripcionId } });
  if (!existe) throw new NotFoundError("Suscripción no encontrada");
  return prisma.suscripcion.update({
    where: { id: suscripcionId },
    data: {
      estado,
      ...(estado === "CANCELADO" ? { fechaFin: new Date() } : { fechaFin: null }),
      updatedById: viewer.id,
    },
  });
}

// ──────────────────────────────────────────────
// Consulta
// ──────────────────────────────────────────────

export interface ListarSuscripcionesOptions {
  clienteId?: string;
  estado?: EstadoServicio;
  incluirCanceladas?: boolean;
}

export async function listarSuscripciones(
  viewer: Viewer,
  options: ListarSuscripcionesOptions = {}
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }

  const where: Prisma.SuscripcionWhereInput = { cliente: { deletedAt: null } };
  if (options.clienteId) where.clienteId = options.clienteId;
  if (options.estado) where.estado = options.estado;
  else if (!options.incluirCanceladas) where.estado = { not: "CANCELADO" };

  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    where.cliente = {
      deletedAt: null,
      sectorId: { in: sectores.map((sec) => sec.sectorId) },
    };
  }

  return prisma.suscripcion.findMany({
    where,
    include: {
      cliente: {
        select: { id: true, nombre: true, apellido: true, empresa: true },
      },
      items: {
        include: { producto: { select: { id: true, nombre: true } } },
      },
    },
    orderBy: [{ estado: "asc" }, { cliente: { nombre: "asc" } }],
  });
}

/**
 * Las órdenes que salieron de los períodos de esta suscripción.
 *
 * Tampoco es una relación directa: se llega por las líneas que citan alguno de
 * sus ítems. Se listan **órdenes y no facturas** porque el borrador que crea el
 * cron todavía no tiene factura, y era justo lo que no se veía desde acá.
 */
export async function ordenesDeSuscripcion(viewer: Viewer, suscripcionId: string) {
  const suscripcion = await getSuscripcion(viewer, suscripcionId);
  const itemIds = suscripcion.items.map((i) => i.id);
  if (itemIds.length === 0) return [];

  const ordenes = await prisma.orden.findMany({
    where: { lineas: { some: { suscripcionItemId: { in: itemIds } } } },
    select: {
      id: true,
      numero: true,
      fecha: true,
      estado: true,
      total: true,
      lineas: {
        where: { suscripcionItemId: { in: itemIds } },
        select: { periodoInicio: true, periodoFin: true, total: true },
        orderBy: { periodoInicio: "asc" },
      },
      facturas: {
        where: { anulada: false },
        select: { numero: true, estado: true, saldo: true },
        take: 1,
      },
    },
    orderBy: { fecha: "desc" },
  });

  return ordenes.map((o) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.fecha,
    estado: o.estado,
    total: Number(o.total),
    // Lo que aportó **este** plan, que puede ser menos que el total de la orden
    // si adentro hay además una visita suelta.
    delPlan: o.lineas.reduce((a, l) => a + Number(l.total), 0),
    periodoInicio: o.lineas[0]?.periodoInicio ?? null,
    periodoFin: o.lineas[o.lineas.length - 1]?.periodoFin ?? null,
    periodos: o.lineas.length,
    factura: o.facturas[0]
      ? {
          numero: o.facturas[0].numero,
          estado: o.facturas[0].estado,
          saldo:
            o.facturas[0].saldo === null ? null : Number(o.facturas[0].saldo),
        }
      : null,
  }));
}

/**
 * Las visitas en las que esta suscripción cubrió algo.
 *
 * La relación no es directa: va por `VisitaProducto.suscripcionItemId`, que es
 * lo que marca "esto lo paga el plan". Una visita con dos productos, uno
 * cubierto y otro no, aparece igual —cubrió algo— y por eso se lista qué
 * producto de la visita fue el cubierto.
 */
export async function visitasDeSuscripcion(viewer: Viewer, suscripcionId: string) {
  const suscripcion = await getSuscripcion(viewer, suscripcionId);
  const itemIds = suscripcion.items.map((i) => i.id);
  if (itemIds.length === 0) return [];

  const productos = await prisma.visitaProducto.findMany({
    where: { suscripcionItemId: { in: itemIds }, visita: { deletedAt: null } },
    select: {
      producto: { select: { nombre: true } },
      visita: {
        select: {
          id: true,
          numero: true,
          fechaProgramada: true,
          fechaRealizada: true,
          estado: true,
        },
      },
    },
    orderBy: { visita: { fechaProgramada: "desc" } },
  });

  // Una visita puede cubrir dos productos del mismo plan: es una sola fila.
  const porVisita = new Map<
    string,
    {
      id: string;
      numero: number;
      fechaProgramada: Date;
      fechaRealizada: Date | null;
      estado: string;
      productos: string[];
    }
  >();
  for (const vp of productos) {
    const actual = porVisita.get(vp.visita.id);
    if (actual) actual.productos.push(vp.producto.nombre);
    else porVisita.set(vp.visita.id, { ...vp.visita, productos: [vp.producto.nombre] });
  }
  return [...porVisita.values()];
}

export async function getSuscripcion(viewer: Viewer, id: string) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
  const s = await prisma.suscripcion.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          id: true, nombre: true, apellido: true, empresa: true, sectorId: true,
        },
      },
      items: {
        include: { producto: { select: { id: true, nombre: true } } },
      },
    },
  });
  if (!s) throw new NotFoundError("Suscripción no encontrada");
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectores = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const ids = sectores.map((sec) => sec.sectorId);
    if (!s.cliente.sectorId || !ids.includes(s.cliente.sectorId)) {
      throw new ForbiddenError();
    }
  }
  return s;
}

/**
 * Productos recurrentes que el cliente todavía no tiene en una suscripción
 * activa.
 *
 * Al editar una suscripción hay que pasar su id en `exceptoSuscripcionId`: sus
 * propios productos no son un conflicto consigo misma, y sin eso el formulario
 * de edición no podría volver a ofrecerlos.
 */
/**
 * Productos que este cliente ya tiene en una suscripción activa.
 *
 * Son los que no se pueden agregar a mano a una orden: entran por el período o
 * por la visita. La pregunta es por cliente porque "recurrente" dejó de ser una
 * etiqueta del catálogo.
 */
export async function productosSuscritos(
  clienteId: string
): Promise<string[]> {
  const items = await prisma.suscripcionItem.findMany({
    where: { suscripcion: { clienteId, estado: "ACTIVO" } },
    select: { productoId: true },
  });
  return [...new Set(items.map((i) => i.productoId))];
}

export async function productosSuscribibles(
  viewer: Viewer,
  clienteId: string,
  exceptoSuscripcionId?: string
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
  // Todo el catálogo es suscribible: lo recurrente lo define el contrato. Solo
  // se saca lo que este cliente ya tiene en una suscripción activa, para no
  // cobrarle el mismo período dos veces.
  return prisma.producto.findMany({
    where: {
      deletedAt: null,
      NOT: {
        suscripcionItems: {
          some: {
            suscripcion: {
              clienteId,
              estado: "ACTIVO",
              ...(exceptoSuscripcionId ? { id: { not: exceptoSuscripcionId } } : {}),
            },
          },
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      ivaTasa: true,
      // Un producto sin vincular se muestra pero no se puede contratar.
      contificoProductoId: true,
    },
    orderBy: { nombre: "asc" },
  });
}

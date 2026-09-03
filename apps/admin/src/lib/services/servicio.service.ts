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

const SERVICIO_LIST_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  ivaTasa: true,
  descripcion: true,
  _count: { select: { suscripcionItems: true } },
} as const;

export interface ListServiciosFilters {
  search?: string;
  cursor?: string;
  limit?: number;
}

/**
 * El código repetido lo atrapa el índice único y no una consulta previa: entre
 * el `findFirst` y el `update` hay lugar para que otra pestaña gane la carrera,
 * y la base es la única que no se equivoca.
 */
async function conCodigoUnico<T>(fn: () => Promise<T>, codigo?: string | null) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        `Ya hay un producto con el código "${codigo?.trim()}".`
      );
    }
    throw error;
  }
}

function ensureAdmin(viewer: Viewer) {
  // Servicios management is admin-only on mobile (matches the v1 plan).
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

function ensureCanReadServicios(viewer: Viewer) {
  // Reading the catalog is broader: ADMIN/STAFF + PERSONAL_ADMIN need it
  // for the asignar-servicio flow even though only ADMIN sees the dedicated
  // Servicios tab in mobile.
  if (
    !isAdminRole(viewer.role) &&
    viewer.role !== "PERSONAL_ADMIN"
  ) {
    throw new ForbiddenError();
  }
}

export async function listServicios(
  viewer: Viewer,
  filters: ListServiciosFilters = {}
) {
  ensureCanReadServicios(viewer);

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.search) {
    const q = filters.search.trim();
    if (q.length > 0) {
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const items = await prisma.producto.findMany({
    where,
    select: SERVICIO_LIST_SELECT,
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  return {
    items: slice,
    nextCursor: hasMore ? slice[slice.length - 1].id : null,
  };
}

export interface CreateServicioPayload {
  nombre: string;
  descripcion?: string | null;
  /** Qué es: un servicio que se ejecuta o un bien que se despacha. */
  tipo?: "SERVICIO" | "BIEN";
  ivaTasa?: number | null;
  /** Cómo se agrupa en el portal. */
  categoriaId?: string | null;
  /**
   * Código del catálogo. Sale impreso como `codigoPrincipal` en cada detalle
   * del XML; si no hay, se emite con un código derivado del id.
   */
  codigo?: string | null;
}

export async function createServicio(
  viewer: Viewer,
  payload: CreateServicioPayload
) {
  ensureAdmin(viewer);

  const producto = await conCodigoUnico(
    () =>
      prisma.producto.create({
        data: {
          nombre: payload.nombre,
          descripcion: payload.descripcion?.trim() || null,
          tipo: payload.tipo ?? "SERVICIO",
          ivaTasa: payload.ivaTasa ?? null,
          categoriaId: payload.categoriaId ?? null,
          codigo: payload.codigo?.trim() || null,
          createdById: viewer.id,
          updatedById: viewer.id,
        },
      }),
    payload.codigo
  );

  return producto;
}

export interface UpdateServicioPayload {
  nombre?: string;
  descripcion?: string | null;
  /** Se acepta para poder validarlo, pero no se puede cambiar. */
  tipo?: "SERVICIO" | "BIEN";
  ivaTasa?: number | null;
  /** Cómo se agrupa en el portal. */
  categoriaId?: string | null;
  /** El que sale impreso como `codigoPrincipal`. */
  codigo?: string | null;
}

export async function updateServicio(
  productoId: string,
  viewer: Viewer,
  payload: UpdateServicioPayload
) {
  ensureAdmin(viewer);

  const actual = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { tipo: true },
  });
  if (!actual) throw new NotFoundError("Producto no encontrado");

  // `tipo` es inmutable: cambiarlo dejaría suscripciones, visitas y
  // líneas de orden con una semántica que ya no corresponde — un UNICO cobrado
  // por trabajo no puede volverse una suscripción mensual sin reinterpretar
  // todo lo ya facturado.
  if (payload.tipo !== undefined && payload.tipo !== actual.tipo) {
    throw new ValidationError(
      "El tipo no se puede cambiar después de crear el producto."
    );
  }

  return conCodigoUnico(
    () =>
      prisma.producto.update({
        where: { id: productoId },
        data: {
          ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
          ...(payload.descripcion !== undefined
            ? { descripcion: payload.descripcion?.trim() || null }
            : {}),
          ...(payload.ivaTasa !== undefined ? { ivaTasa: payload.ivaTasa } : {}),
          ...(payload.categoriaId !== undefined
            ? { categoriaId: payload.categoriaId }
            : {}),
          ...(payload.codigo !== undefined
            ? { codigo: payload.codigo?.trim() || null }
            : {}),
          updatedById: viewer.id,
        },
      }),
    payload.codigo
  );
}

export async function getServicio(productoId: string, viewer: Viewer) {
  ensureCanReadServicios(viewer);
  const servicio = await prisma.producto.findFirst({
    where: { id: productoId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      tipo: true,
      createdAt: true,
      _count: { select: { suscripcionItems: true } },
    },
  });
  if (!servicio) throw new NotFoundError("Servicio no encontrado");
  return servicio;
}

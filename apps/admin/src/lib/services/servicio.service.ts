import { prisma } from "@/lib/prisma";
import {
  actualizarNombreEnContifico,
  sincronizarProducto,
} from "@/lib/contifico/productos";
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
  /** Cómo se vende. Contífico no lo conoce: vive solo en el portal. */
  /** Cada cuánto se cobra. Solo aplica a suscripciones. */
  ivaTasa?: number | null;
  /** Vínculo con un producto que ya existe en Contífico. Opcional. */
  contificoProductoId?: string | null;
  codigo?: string | null;
  /** Renombrarlo en Contífico para que coincida con el nombre del portal. */
  actualizarNombre?: boolean;
  /** Crearlo en Contífico al guardar, en vez de vincularlo a uno existente. */
  crearEnContifico?: boolean;
}

export async function createServicio(
  viewer: Viewer,
  payload: CreateServicioPayload
) {
  ensureAdmin(viewer);

  if (payload.contificoProductoId) {
    const tomado = await prisma.producto.findFirst({
      where: { contificoProductoId: payload.contificoProductoId },
      select: { nombre: true },
    });
    if (tomado) {
      throw new ConflictError(
        `Ese producto de Contífico ya está vinculado a "${tomado.nombre}".`
      );
    }
  }

  const producto = await prisma.producto.create({
    data: {
      nombre: payload.nombre,
      descripcion: payload.descripcion?.trim() || null,
      tipo: payload.tipo ?? "SERVICIO",
      ivaTasa: payload.ivaTasa ?? null,
      contificoProductoId: payload.contificoProductoId ?? null,
      codigo: payload.contificoProductoId ? (payload.codigo ?? null) : null,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
  });

  // Renombrar allá es un efecto sobre su catálogo, pero el producto local ya
  // está guardado: si falla, se avisa y el vínculo queda igual — el nombre se
  // puede corregir después desde la ficha.
  if (payload.actualizarNombre && producto.contificoProductoId) {
    try {
      await actualizarNombreEnContifico(
        producto.contificoProductoId,
        producto.nombre
      );
    } catch {
      // El vínculo vale igual; solo no se renombró.
    }
  }

  // Crear en Contífico necesita el id ya asignado, porque el código se deriva
  // de él. Si falla, el producto queda creado y sin vincular: es recuperable
  // desde su ficha, y perder el alta entera por un problema de red sería peor.
  if (payload.crearEnContifico && !producto.contificoProductoId) {
    try {
      await sincronizarProducto(producto);
      return prisma.producto.findUniqueOrThrow({ where: { id: producto.id } });
    } catch {
      return producto;
    }
  }

  return producto;
}

export interface UpdateServicioPayload {
  nombre?: string;
  descripcion?: string | null;
  /** Se acepta para poder validarlo, pero no se puede cambiar. */
  tipo?: "SERVICIO" | "BIEN";
  ivaTasa?: number | null;
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
  // todo lo ya facturado. Además `tipo` ya está sincronizado con Contífico.
  if (payload.tipo !== undefined && payload.tipo !== actual.tipo) {
    throw new ValidationError(
      "El tipo no se puede cambiar después de crear el producto."
    );
  }

  return prisma.producto.update({
    where: { id: productoId },
    data: {
      ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
      ...(payload.descripcion !== undefined
        ? { descripcion: payload.descripcion?.trim() || null }
        : {}),
      ...(payload.ivaTasa !== undefined ? { ivaTasa: payload.ivaTasa } : {}),
      updatedById: viewer.id,
    },
  });
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

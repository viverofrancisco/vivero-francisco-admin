import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

const SERVICIO_LIST_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  descripcion: true,
  _count: { select: { clientes: { where: { estado: "ACTIVO" } } } },
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
  const items = await prisma.servicio.findMany({
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
  tipo: "RECURRENTE" | "UNICO";
}

export async function createServicio(
  viewer: Viewer,
  payload: CreateServicioPayload
) {
  ensureAdmin(viewer);
  return prisma.servicio.create({
    data: {
      nombre: payload.nombre,
      descripcion: payload.descripcion?.trim() || null,
      tipo: payload.tipo,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
  });
}

export interface UpdateServicioPayload {
  nombre?: string;
  descripcion?: string | null;
  tipo?: "RECURRENTE" | "UNICO";
}

export async function updateServicio(
  servicioId: string,
  viewer: Viewer,
  payload: UpdateServicioPayload
) {
  ensureAdmin(viewer);
  try {
    return await prisma.servicio.update({
      where: { id: servicioId },
      data: {
        ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
        ...(payload.descripcion !== undefined
          ? { descripcion: payload.descripcion?.trim() || null }
          : {}),
        ...(payload.tipo !== undefined ? { tipo: payload.tipo } : {}),
        updatedById: viewer.id,
      },
    });
  } catch {
    throw new NotFoundError("Servicio no encontrado");
  }
}

export async function getServicio(servicioId: string, viewer: Viewer) {
  ensureCanReadServicios(viewer);
  const servicio = await prisma.servicio.findFirst({
    where: { id: servicioId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      tipo: true,
      createdAt: true,
      _count: {
        select: { clientes: { where: { estado: "ACTIVO" } } },
      },
    },
  });
  if (!servicio) throw new NotFoundError("Servicio no encontrado");
  return servicio;
}

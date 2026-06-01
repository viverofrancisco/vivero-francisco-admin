import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

export async function getClienteProfile(viewer: Viewer) {
  if (viewer.role !== "CLIENTE") {
    throw new ForbiddenError();
  }
  if (!viewer.clienteId) {
    throw new NotFoundError("Tu cuenta no está vinculada a un cliente.");
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: viewer.clienteId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      telefono: true,
      direccion: true,
      ciudad: true,
      sector: { select: { id: true, nombre: true } },
    },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  const proximaVisita = await prisma.visita.findFirst({
    where: {
      deletedAt: null,
      estado: "PROGRAMADA",
      fechaProgramada: { gte: startOfToday() },
      clienteServicio: { clienteId: cliente.id },
    },
    orderBy: { fechaProgramada: "asc" },
    select: {
      id: true,
      fechaProgramada: true,
      horaEntrada: true,
      clienteServicio: {
        select: {
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
    },
  });

  return { cliente, proximaVisita };
}

// ──────────────────────────────────────────────
// Staff-side cliente list / detail
// ──────────────────────────────────────────────

const CLIENTE_LIST_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  ciudad: true,
  sector: { select: { id: true, nombre: true } },
} as const;

async function buildClienteWhereForStaff(viewer: Viewer) {
  if (isAdminRole(viewer.role)) return { deletedAt: null };
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorIds = await getSectorIdsForUser(viewer.id);
    return { deletedAt: null, sectorId: { in: sectorIds } };
  }
  throw new ForbiddenError();
}

async function getSectorIdsForUser(userId: string): Promise<string[]> {
  const assignments = await prisma.sectorAdmin.findMany({
    where: { userId },
    select: { sectorId: true },
  });
  return assignments.map((a) => a.sectorId);
}

export interface ListClientesFilters {
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listClientes(
  viewer: Viewer,
  filters: ListClientesFilters = {}
) {
  const where = await buildClienteWhereForStaff(viewer);
  if (filters.search) {
    const q = filters.search.trim();
    if (q.length > 0) {
      Object.assign(where, {
        OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { apellido: { contains: q, mode: "insensitive" } },
          { telefono: { contains: q } },
        ],
      });
    }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const items = await prisma.cliente.findMany({
    where,
    select: CLIENTE_LIST_SELECT,
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

export async function getClienteForStaff(clienteId: string, viewer: Viewer) {
  const baseWhere = await buildClienteWhereForStaff(viewer);
  const cliente = await prisma.cliente.findFirst({
    where: { ...baseWhere, id: clienteId },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      direccion: true,
      numeroCasa: true,
      ciudad: true,
      referencia: true,
      notas: true,
      metrosCuadrados: true,
      sector: { select: { id: true, nombre: true } },
      servicios: {
        where: { estado: { not: "CANCELADO" } },
        select: {
          id: true,
          estado: true,
          precio: true,
          frecuenciaMensual: true,
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
    },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  return cliente;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ──────────────────────────────────────────────
// Create / update
// ──────────────────────────────────────────────

export interface CreateClientePayload {
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  sectorId?: string | null;
  direccion?: string | null;
  numeroCasa?: string | null;
  referencia?: string | null;
  notas?: string | null;
  metrosCuadrados?: number | null;
}

function ensureCanWrite(viewer: Viewer) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

async function ensureSectorAllowed(
  viewer: Viewer,
  sectorId: string | null | undefined
) {
  if (viewer.role !== "PERSONAL_ADMIN") return;
  if (!sectorId) {
    throw new ForbiddenError(
      "Debes asignar un sector al que tengas acceso."
    );
  }
  const sectorIds = await getSectorIdsForUser(viewer.id);
  if (!sectorIds.includes(sectorId)) {
    throw new ForbiddenError("No tienes acceso a ese sector.");
  }
}

export interface AsignarServicioPayload {
  servicioId: string;
  precio: number;
  iva?: number;
  frecuenciaMensual?: number | null;
  fechaInicio: string;
  notas?: string | null;
}

export async function asignarServicioToCliente(
  clienteId: string,
  viewer: Viewer,
  payload: AsignarServicioPayload
) {
  ensureCanWrite(viewer);
  await getClienteForStaff(clienteId, viewer); // sector check + existence

  const servicio = await prisma.servicio.findFirst({
    where: { id: payload.servicioId, deletedAt: null },
    select: { id: true },
  });
  if (!servicio) throw new NotFoundError("Servicio no encontrado");

  return prisma.clienteServicio.create({
    data: {
      clienteId,
      servicioId: payload.servicioId,
      precio: payload.precio,
      iva: payload.iva ?? 0,
      frecuenciaMensual: payload.frecuenciaMensual ?? null,
      fechaInicio: new Date(payload.fechaInicio),
      notas: payload.notas?.trim() || null,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
  });
}

export async function createCliente(
  viewer: Viewer,
  payload: CreateClientePayload
) {
  ensureCanWrite(viewer);
  await ensureSectorAllowed(viewer, payload.sectorId);

  return prisma.cliente.create({
    data: {
      nombre: payload.nombre,
      apellido: payload.apellido ?? null,
      email: payload.email ?? null,
      telefono: payload.telefono ?? null,
      ciudad: payload.ciudad ?? null,
      sectorId: payload.sectorId ?? null,
      direccion: payload.direccion ?? null,
      numeroCasa: payload.numeroCasa ?? null,
      referencia: payload.referencia ?? null,
      notas: payload.notas ?? null,
      metrosCuadrados: payload.metrosCuadrados ?? null,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
  });
}

export async function updateCliente(
  clienteId: string,
  viewer: Viewer,
  payload: Partial<CreateClientePayload>
) {
  ensureCanWrite(viewer);

  // Make sure the viewer can already see this cliente (sector check).
  await getClienteForStaff(clienteId, viewer);

  // If the update changes sector, validate against viewer's sectors.
  if (payload.sectorId !== undefined) {
    await ensureSectorAllowed(viewer, payload.sectorId);
  }

  try {
    return await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
        ...(payload.apellido !== undefined ? { apellido: payload.apellido } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.telefono !== undefined ? { telefono: payload.telefono } : {}),
        ...(payload.ciudad !== undefined ? { ciudad: payload.ciudad } : {}),
        ...(payload.sectorId !== undefined ? { sectorId: payload.sectorId } : {}),
        ...(payload.direccion !== undefined ? { direccion: payload.direccion } : {}),
        ...(payload.numeroCasa !== undefined ? { numeroCasa: payload.numeroCasa } : {}),
        ...(payload.referencia !== undefined ? { referencia: payload.referencia } : {}),
        ...(payload.notas !== undefined ? { notas: payload.notas } : {}),
        ...(payload.metrosCuadrados !== undefined
          ? { metrosCuadrados: payload.metrosCuadrados }
          : {}),
        updatedById: viewer.id,
      },
    });
  } catch {
    throw new NotFoundError("Cliente no encontrado");
  }
}

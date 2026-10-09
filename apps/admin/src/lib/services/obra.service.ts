import type { ObraBody, ObraDetalle, ObraFila, EstadoObra } from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { filtroClientePorTexto } from "./busqueda";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isAdminRole, type Viewer } from "./viewer";

/**
 * Obras: cada trabajo puntual del vivero, con principio y fin.
 *
 * Pertenece a un centro de costo —casi siempre *Obras*— y se le cargan
 * ventas, compras y consumos, para saber cuánto deja. Son de ADMIN y STAFF,
 * como todo lo que tiene que ver con plata.
 */

function ensureStaff(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError("Las obras son de administradores y staff");
  }
}

const SELECT = {
  id: true,
  numero: true,
  nombre: true,
  estado: true,
  centroCosto: { select: { id: true, nombre: true } },
  presupuesto: true,
  fechaInicio: true,
  fechaFin: true,
  notas: true,
  contificoCodigo: true,
  updatedAt: true,
  updatedByNombre: true,
  cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
  propiedad: { select: { id: true, nombre: true } },
} satisfies Prisma.ObraSelect;

type Fila = Prisma.ObraGetPayload<{ select: typeof SELECT }>;

/** `@db.Date` llega a medianoche UTC: el ISO recortado es el día guardado. */
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function aFila(o: Fila): ObraFila {
  return {
    id: o.id,
    numero: o.numero,
    nombre: o.nombre,
    centroCosto: o.centroCosto,
    estado: o.estado,
    cliente: o.cliente,
    propiedad: o.propiedad,
    presupuesto: o.presupuesto === null ? null : Number(o.presupuesto),
    fechaInicio: dia(o.fechaInicio),
    fechaFin: dia(o.fechaFin),
  };
}

function aDetalle(o: Fila): ObraDetalle {
  return {
    ...aFila(o),
    notas: o.notas,
    contificoCodigo: o.contificoCodigo,
    updatedAt: o.updatedAt.toISOString(),
    updatedByNombre: o.updatedByNombre,
  };
}

export async function listarObras(
  viewer: Viewer,
  filtros: { q?: string; estado?: EstadoObra; centroCostoId?: string } = {}
): Promise<ObraFila[]> {
  ensureStaff(viewer);
  const q = filtros.q?.trim();
  const numero = q && /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const where: Prisma.ObraWhereInput = {
    deletedAt: null,
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.centroCostoId ? { centroCostoId: filtros.centroCostoId } : {}),
    ...(q
      ? {
          OR: [
            // Cada palabra en el nombre de la obra, o el cliente por las
            // reglas de siempre (nombre y apellido en cualquier orden).
            {
              AND: q
                .split(/\s+/)
                .filter(Boolean)
                .map((p) => ({ nombre: { contains: p, mode: "insensitive" as const } })),
            },
            { cliente: filtroClientePorTexto(q) ?? undefined },
            ...(numero !== null ? [{ numero }] : []),
          ],
        }
      : {}),
  };
  const obras = await prisma.obra.findMany({
    where,
    select: SELECT,
    // Las que están en curso arriba: son las que reciben movimientos.
    orderBy: [{ estado: "asc" }, { nombre: "asc" }],
  });
  return obras.map(aFila);
}

export async function obtenerObra(viewer: Viewer, id: string): Promise<ObraDetalle> {
  ensureStaff(viewer);
  const obra = await prisma.obra.findFirst({ where: { id, deletedAt: null }, select: SELECT });
  if (!obra) throw new NotFoundError("Obra no encontrada");
  return aDetalle(obra);
}

/** Que el cliente exista, que la propiedad sea suya y que el centro esté activo. */
async function validarClienteYPropiedad(datos: ObraBody) {
  if (datos.centroCostoId) {
    const centro = await prisma.centroCosto.findUnique({
      where: { id: datos.centroCostoId },
      select: { activo: true },
    });
    if (!centro) throw new ValidationError("El centro de costo no existe");
    if (!centro.activo) throw new ValidationError("Ese centro de costo está inactivo");
  }
  if (datos.clienteId) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: datos.clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!cliente) throw new ValidationError("El cliente no existe");
  }
  if (datos.propiedadId) {
    const propiedad = await prisma.propiedad.findFirst({
      where: { id: datos.propiedadId, deletedAt: null },
      select: { clienteId: true },
    });
    if (!propiedad || propiedad.clienteId !== datos.clienteId) {
      throw new ValidationError("La propiedad no es de ese cliente");
    }
  }
}

function datosDeObra(datos: ObraBody) {
  return {
    nombre: datos.nombre.trim(),
    centroCostoId: datos.centroCostoId ?? null,
    estado: datos.estado,
    clienteId: datos.clienteId ?? null,
    propiedadId: datos.propiedadId ?? null,
    presupuesto: datos.presupuesto ?? null,
    // Al mediodía: así ninguna zona horaria la corre de día.
    fechaInicio: datos.fechaInicio ? new Date(`${datos.fechaInicio}T12:00:00Z`) : null,
    fechaFin: datos.fechaFin ? new Date(`${datos.fechaFin}T12:00:00Z`) : null,
    notas: datos.notas?.trim() || null,
  };
}

export async function crearObra(viewer: Viewer, datos: ObraBody): Promise<ObraDetalle> {
  ensureStaff(viewer);
  await validarClienteYPropiedad(datos);
  const obra = await prisma.obra.create({
    data: {
      ...datosDeObra(datos),
      createdById: viewer.id,
      updatedById: viewer.id,
      updatedByNombre: viewer.nombre,
    },
    select: SELECT,
  });
  return aDetalle(obra);
}

export async function actualizarObra(
  viewer: Viewer,
  id: string,
  datos: ObraBody
): Promise<ObraDetalle> {
  ensureStaff(viewer);
  const existe = await prisma.obra.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existe) throw new NotFoundError("Obra no encontrada");
  await validarClienteYPropiedad(datos);
  const obra = await prisma.obra.update({
    where: { id },
    data: { ...datosDeObra(datos), updatedById: viewer.id, updatedByNombre: viewer.nombre },
    select: SELECT,
  });
  return aDetalle(obra);
}

/**
 * Archivar, no borrar: cuando la contabilidad le cargue movimientos, esos
 * asientos tienen que seguir diciendo de qué obra eran.
 */
export async function archivarObra(viewer: Viewer, id: string): Promise<void> {
  ensureStaff(viewer);
  const existe = await prisma.obra.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existe) throw new NotFoundError("Obra no encontrada");
  await prisma.obra.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: viewer.id, updatedByNombre: viewer.nombre },
  });
}

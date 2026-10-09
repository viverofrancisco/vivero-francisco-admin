import type { CentroCostoBody, CentroCostoFila } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import { isAdminRole, type Viewer } from "./viewer";

/**
 * Centros de costo: las partes de la empresa (Administración, las sucursales,
 * Mantenimiento, Obras). Pocos y permanentes; las obras cuelgan de ellos.
 * ADMIN y STAFF, como todo lo que tiene que ver con plata.
 */

function ensureContabilidad(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError("La contabilidad es de administradores y staff");
  }
}

export async function listarCentrosCosto(viewer: Viewer): Promise<CentroCostoFila[]> {
  ensureContabilidad(viewer);
  const centros = await prisma.centroCosto.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      orden: true,
      activo: true,
      _count: { select: { obras: { where: { deletedAt: null } } } },
    },
  });
  return centros.map(({ _count, ...c }) => ({ ...c, obras: _count.obras }));
}

async function ensureNombreLibre(nombre: string, excepto?: string) {
  const otro = await prisma.centroCosto.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(excepto ? { id: { not: excepto } } : {}) },
    select: { id: true },
  });
  if (otro) throw new ConflictError(`Ya existe el centro de costo "${nombre}"`);
}

export async function crearCentroCosto(viewer: Viewer, datos: CentroCostoBody) {
  ensureContabilidad(viewer);
  const nombre = datos.nombre.trim();
  await ensureNombreLibre(nombre);
  // Al final de la lista, si no se dice otra cosa.
  const ultimo = await prisma.centroCosto.aggregate({ _max: { orden: true } });
  return prisma.centroCosto.create({
    data: { nombre, orden: datos.orden ?? (ultimo._max.orden ?? 0) + 10, activo: datos.activo ?? true },
  });
}

export async function editarCentroCosto(viewer: Viewer, id: string, datos: CentroCostoBody) {
  ensureContabilidad(viewer);
  const existe = await prisma.centroCosto.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw new NotFoundError("Centro de costo no encontrado");
  const nombre = datos.nombre.trim();
  await ensureNombreLibre(nombre, id);
  return prisma.centroCosto.update({
    where: { id },
    data: {
      nombre,
      ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
    },
  });
}

/**
 * Borrar es solo para el que se creó por error: sin obras. El que se dejó de
 * usar se desactiva, y sigue en los reportes de lo que ya tiene.
 */
export async function eliminarCentroCosto(viewer: Viewer, id: string) {
  ensureContabilidad(viewer);
  const centro = await prisma.centroCosto.findUnique({
    where: { id },
    select: { _count: { select: { obras: true } } },
  });
  if (!centro) throw new NotFoundError("Centro de costo no encontrado");
  if (centro._count.obras > 0) {
    throw new ConflictError(
      `Tiene ${centro._count.obras} obra${centro._count.obras === 1 ? "" : "s"}. Desactívalo en vez de eliminarlo`
    );
  }
  await prisma.centroCosto.delete({ where: { id } });
}

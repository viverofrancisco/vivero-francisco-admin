import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export async function listTiposActividad(options: { incluirInactivos?: boolean } = {}) {
  return prisma.tipoActividad.findMany({
    where: options.incluirInactivos ? undefined : { activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

export interface TipoActividadInput {
  nombre: string;
  descripcionTemplate?: string | null;
  orden?: number;
  activo?: boolean;
}

export async function createTipoActividad(viewer: Viewer, input: TipoActividadInput) {
  ensureAdmin(viewer);
  const nombre = input.nombre.trim();
  if (!nombre) throw new ValidationError("El nombre es obligatorio.");
  return prisma.tipoActividad.create({
    data: {
      nombre,
      descripcionTemplate: input.descripcionTemplate?.trim() || null,
      orden: input.orden ?? 0,
      activo: input.activo ?? true,
    },
  });
}

export async function updateTipoActividad(
  viewer: Viewer,
  id: string,
  input: Partial<TipoActividadInput>
) {
  ensureAdmin(viewer);
  const existing = await prisma.tipoActividad.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  return prisma.tipoActividad.update({
    where: { id },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.descripcionTemplate !== undefined
        ? { descripcionTemplate: input.descripcionTemplate?.trim() || null }
        : {}),
      ...(input.orden !== undefined ? { orden: input.orden } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    },
  });
}

export async function deleteTipoActividad(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  // Soft delete via `activo = false` to preserve references in past
  // InformeSeccion rows (their `tipoActividadId` stays valid).
  await prisma.tipoActividad.update({
    where: { id },
    data: { activo: false },
  });
}

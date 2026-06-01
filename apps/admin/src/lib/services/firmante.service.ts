import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export async function listFirmantes() {
  return prisma.firmante.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

export async function listDefaultFirmantes() {
  return prisma.firmante.findMany({
    where: { isDefault: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    take: 3,
  });
}

export interface FirmanteInput {
  nombre: string;
  cedula?: string | null;
  isDefault?: boolean;
  orden?: number;
}

export async function createFirmante(viewer: Viewer, input: FirmanteInput) {
  ensureAdmin(viewer);
  const nombre = input.nombre.trim();
  if (!nombre) throw new ValidationError("El nombre es obligatorio.");
  return prisma.firmante.create({
    data: {
      nombre,
      cedula: input.cedula?.trim() || null,
      isDefault: input.isDefault ?? false,
      orden: input.orden ?? 0,
    },
  });
}

export async function updateFirmante(
  viewer: Viewer,
  id: string,
  input: Partial<FirmanteInput>
) {
  ensureAdmin(viewer);
  const existing = await prisma.firmante.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  return prisma.firmante.update({
    where: { id },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.cedula !== undefined
        ? { cedula: input.cedula?.trim() || null }
        : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.orden !== undefined ? { orden: input.orden } : {}),
    },
  });
}

export async function deleteFirmante(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  const existing = await prisma.firmante.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  await prisma.firmante.delete({ where: { id } });
}

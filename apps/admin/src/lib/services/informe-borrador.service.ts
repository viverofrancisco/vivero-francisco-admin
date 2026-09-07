import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Borradores de informe: el asistente a medio llenar, guardado para seguir
 * después.
 *
 * No son `Informe` sin PDF. Un informe es un documento emitido —tiene número,
 * archivo y versiones— y un borrador no tiene nada de eso; meterlos en la misma
 * tabla obligaría a que todo lo que lista informes aclare cuáles no lo son.
 *
 * **Son del equipo, no de quien los abrió.** Los informes ya son cosa de
 * ADMIN/STAFF, y un borrador que solo ve su autor es uno que se pierde cuando
 * esa persona no está. Se guarda quién lo creó y quién lo tocó último, que es
 * lo que hace falta para saber a quién preguntarle.
 */
function ensureBorradores(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface BorradorInput {
  clienteId?: string | null;
  titulo?: string | null;
  /** El estado del asistente. Lo interpreta el asistente, no el servidor. */
  contenido: unknown;
}

export async function listarBorradores(viewer: Viewer) {
  ensureBorradores(viewer);
  return prisma.informeBorrador.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titulo: true,
      createdAt: true,
      createdByNombre: true,
      updatedAt: true,
      updatedByNombre: true,
      cliente: {
        select: { id: true, nombre: true, apellido: true, empresa: true },
      },
    },
  });
}

export async function getBorrador(viewer: Viewer, id: string) {
  ensureBorradores(viewer);
  const borrador = await prisma.informeBorrador.findUnique({ where: { id } });
  if (!borrador) throw new NotFoundError("Borrador no encontrado");
  return borrador;
}

/**
 * Crea o actualiza. Sin `id` es uno nuevo; con `id`, se pisa el que hay.
 *
 * Se pisa y no se versiona: un borrador es un trabajo en curso, y guardar cada
 * vez que alguien aprieta el botón dejaría veinte casi iguales. Las versiones
 * empiezan cuando el informe existe.
 */
export async function guardarBorrador(
  viewer: Viewer,
  input: BorradorInput,
  id?: string | null
) {
  ensureBorradores(viewer);
  const datos = {
    clienteId: input.clienteId ?? null,
    titulo: input.titulo?.trim() || null,
    contenido: (input.contenido ?? {}) as Prisma.InputJsonValue,
    updatedById: viewer.id,
    updatedByNombre: viewer.nombre ?? null,
  };

  if (id) {
    // `update` y no `upsert`: si el id no existe es porque alguien ya lo
    // publicó o lo borró, y crear uno nuevo con ese id escondería el problema.
    const existe = await prisma.informeBorrador.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundError("Borrador no encontrado");
    return prisma.informeBorrador.update({
      where: { id },
      data: datos,
      select: { id: true, updatedAt: true },
    });
  }

  return prisma.informeBorrador.create({
    data: {
      ...datos,
      createdById: viewer.id,
      createdByNombre: viewer.nombre ?? null,
    },
    select: { id: true, updatedAt: true },
  });
}

export async function borrarBorrador(viewer: Viewer, id: string) {
  ensureBorradores(viewer);
  // `deleteMany` para no tirar cuando ya no está: borrar dos veces es lo mismo
  // que borrar una, y el caso normal es que lo borre el propio guardado del
  // informe justo después de generarlo.
  await prisma.informeBorrador.deleteMany({ where: { id } });
}

/**
 * Categorías del catálogo, del portal.
 *
 * **No son un espejo de las de Contífico.** Allá una categoría es configuración
 * contable —lleva la `cuenta_venta` que el producto hereda— y el árbol es de
 * ellos: en la cuenta de pruebas hay 2.939, casi todas de otros integradores.
 * Acá una categoría es lo que sirve para encontrar un producto en una lista.
 *
 * Lo que une las dos caras es `contificoCategoriaId`: con qué categoría de
 * ellos se crean los productos de esta. Sin eso Contífico les pone la suya por
 * defecto, que es de tipo PROD, y un servicio termina contabilizado como venta
 * de bienes.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { ForbiddenError } from "./errors";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface CategoriaInput {
  nombre: string;
  orden?: number;
  /** Con qué categoría de Contífico se crean sus productos. */
  contificoCategoriaId?: string | null;
  contificoCategoriaNombre?: string | null;
}

/** Todas, con cuántos productos vivos tiene cada una. */
export async function listarCategorias(viewer: Viewer) {
  ensureAdmin(viewer);
  return prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: {
      _count: { select: { productos: { where: { deletedAt: null } } } },
    },
  });
}

function limpiar(payload: CategoriaInput) {
  const nombre = payload.nombre.trim();
  if (!nombre) throw new ValidationError("La categoría necesita un nombre.");
  return {
    nombre,
    orden: payload.orden ?? 0,
    contificoCategoriaId: payload.contificoCategoriaId?.trim() || null,
    contificoCategoriaNombre: payload.contificoCategoriaNombre?.trim() || null,
  };
}

/**
 * El nombre repetido se atrapa por el índice único y no por una consulta
 * previa: entre el `findFirst` y el `create` hay lugar para que otra pestaña
 * gane la carrera, y la base es la única que no se equivoca.
 */
function comoConflicto(error: unknown, nombre: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictError(`Ya hay una categoría llamada "${nombre}".`);
  }
  throw error;
}

export async function crearCategoria(viewer: Viewer, payload: CategoriaInput) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.categoria.create({ data: datos });
  } catch (error) {
    comoConflicto(error, datos.nombre);
  }
}

export async function actualizarCategoria(
  viewer: Viewer,
  id: string,
  payload: CategoriaInput
) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.categoria.update({ where: { id }, data: datos });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Categoría no encontrada");
    }
    comoConflicto(error, datos.nombre);
  }
}

/**
 * La borra de verdad.
 *
 * No hay borrado suave: una categoría es una etiqueta para agrupar, no un hecho
 * que haya que conservar, y una archivada que sigue colgando de sus productos
 * sería una categoría que se ve en las fichas pero no en la lista. El `FK` es
 * `SET NULL`, así que sus productos quedan sin categoría — siguen enteros, con
 * su nombre, su precio y todo lo que los nombra en visitas y facturas.
 */
export async function borrarCategoria(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  try {
    return await prisma.categoria.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Categoría no encontrada");
    }
    throw error;
  }
}

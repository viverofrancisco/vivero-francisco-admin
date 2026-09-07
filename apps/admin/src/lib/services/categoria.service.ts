/**
 * Categorías del catálogo.
 *
 * Es lo que sirve para encontrar un producto en una lista, nada más: no sale
 * impresa en la factura ni cambia cómo se emite.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { ForbiddenError } from "./errors";
import { sanitizarHtml } from "@/lib/html-seguro";
import { publicUrlForKey } from "@/lib/s3";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface CategoriaInput {
  nombre: string;
  orden?: number;
  /** De qué se trata. HTML de un editor: se sanea acá. */
  descripcion?: string | null;
  /** La foto que la representa. Sale de la biblioteca. */
  mediaId?: string | null;
}

/** Todas, con cuántos productos vivos tiene cada una. */
export async function listarCategorias(viewer: Viewer) {
  ensureAdmin(viewer);
  return prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: {
      // A través de la puente, y contando solo los productos vivos: un
      // archivado sigue teniendo su fila y sumaría de más.
      _count: {
        select: { productos: { where: { producto: { deletedAt: null } } } },
      },
    },
  });
}

function limpiar(payload: CategoriaInput) {
  const nombre = payload.nombre.trim();
  if (!nombre) throw new ValidationError("La categoría necesita un nombre.");
  return {
    nombre,
    orden: payload.orden ?? 0,
    ...(payload.descripcion !== undefined
      ? { descripcion: sanitizarHtml(payload.descripcion) }
      : {}),
    ...(payload.mediaId !== undefined ? { mediaId: payload.mediaId } : {}),
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
 * sería una categoría que se ve en las fichas pero no en la lista. Lo que se
 * borra en cascada son las filas de `ProductoCategoria`: dejar de agrupar algo
 * no es darlo de baja, así que los productos quedan enteros y con una etiqueta
 * menos.
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

/**
 * La ficha de una categoría, con los productos que agrupa.
 *
 * Los trae **enteros y sin paginar**: el catálogo de un vivero son decenas, no
 * miles, y una categoría existe justamente para verla completa.
 */
export async function getCategoria(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      orden: true,
      descripcion: true,
      mediaId: true,
      media: { select: { id: true, key: true, alt: true, nombre: true } },
      productos: {
        where: { producto: { deletedAt: null } },
        orderBy: { producto: { nombre: "asc" } },
        select: {
          producto: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
              estado: true,
              imagenes: {
                orderBy: { posicion: "asc" },
                take: 1,
                select: { media: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!categoria) throw new NotFoundError("Categoría no encontrada");

  return {
    id: categoria.id,
    nombre: categoria.nombre,
    orden: categoria.orden,
    descripcion: categoria.descripcion,
    imagen: categoria.media
      ? {
          id: categoria.media.id,
          url: publicUrlForKey(categoria.media.key),
          alt: categoria.media.alt,
          nombre: categoria.media.nombre,
        }
      : null,
    productos: categoria.productos.map((pc) => ({
      id: pc.producto.id,
      nombre: pc.producto.nombre,
      tipo: pc.producto.tipo,
      estado: pc.producto.estado,
      imagenUrl: pc.producto.imagenes[0]
        ? publicUrlForKey(pc.producto.imagenes[0].media.key)
        : null,
    })),
  };
}

/**
 * Suma productos a la categoría.
 *
 * `skipDuplicates` en vez de fallar: agregar uno que ya estaba es un pedido sin
 * efecto, no un error — y con multiselección es fácil que pase.
 */
export async function agregarProductos(
  viewer: Viewer,
  categoriaId: string,
  productoIds: string[]
) {
  ensureAdmin(viewer);
  const categoria = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: { id: true },
  });
  if (!categoria) throw new NotFoundError("Categoría no encontrada");

  await prisma.productoCategoria.createMany({
    data: productoIds.map((productoId) => ({ categoriaId, productoId })),
    skipDuplicates: true,
  });
  return getCategoria(viewer, categoriaId);
}

/** Lo saca de la categoría. El producto queda entero, con una etiqueta menos. */
export async function quitarProducto(
  viewer: Viewer,
  categoriaId: string,
  productoId: string
) {
  ensureAdmin(viewer);
  await prisma.productoCategoria.deleteMany({
    where: { categoriaId, productoId },
  });
  return getCategoria(viewer, categoriaId);
}

/**
 * Los productos que **todavía no** están en la categoría, para poder elegirlos.
 *
 * Incluye los borradores: una categoría es cómo se ordena el catálogo, y
 * ordenar algo que todavía no se vende es exactamente cuándo conviene hacerlo.
 */
export async function productosParaAgregar(
  viewer: Viewer,
  categoriaId: string,
  search?: string
) {
  ensureAdmin(viewer);
  const productos = await prisma.producto.findMany({
    where: {
      deletedAt: null,
      categorias: { none: { categoriaId } },
      ...(search?.trim()
        ? { nombre: { contains: search.trim(), mode: "insensitive" } }
        : {}),
    },
    orderBy: { nombre: "asc" },
    take: 50,
    select: {
      id: true,
      nombre: true,
      tipo: true,
      estado: true,
      imagenes: {
        orderBy: { posicion: "asc" },
        take: 1,
        select: { media: { select: { key: true } } },
      },
    },
  });
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    estado: p.estado,
    imagenUrl: p.imagenes[0] ? publicUrlForKey(p.imagenes[0].media.key) : null,
  }));
}

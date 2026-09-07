/**
 * Qué imágenes de la biblioteca usa un producto.
 *
 * **Del producto, no de la variante.** Lo que una foto muestra suele ser un eje
 * solo —el color— así que colgarla de cada combinación obligaría a subir la
 * misma imagen una vez por talle: con 3 colores × 4 tamaños, la del rojo iría
 * cuatro veces. La variante *elige* cuál de estas es la suya
 * (`Variante.imagenId`), y la que no elige ninguna muestra la primera.
 *
 * El archivo en sí vive en `media.service`: acá solo se decide cuál usa este
 * producto y en qué orden. Sacar una la saca del producto, no de la biblioteca.
 */
import { prisma } from "@/lib/prisma";
import { publicUrlForKey } from "@/lib/s3";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface ImagenDeProducto {
  id: string;
  mediaId: string;
  url: string;
  alt: string | null;
  nombre: string;
  posicion: number;
}

const SELECT = {
  id: true,
  mediaId: true,
  posicion: true,
  media: { select: { key: true, alt: true, nombre: true } },
} as const;

function armar(fila: {
  id: string;
  mediaId: string;
  posicion: number;
  media: { key: string; alt: string | null; nombre: string };
}): ImagenDeProducto {
  return {
    id: fila.id,
    mediaId: fila.mediaId,
    url: publicUrlForKey(fila.media.key),
    alt: fila.media.alt,
    nombre: fila.media.nombre,
    posicion: fila.posicion,
  };
}

export async function listarImagenes(
  viewer: Viewer,
  productoId: string
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);
  const filas = await prisma.productoImagen.findMany({
    where: { productoId },
    orderBy: { posicion: "asc" },
    select: SELECT,
  });
  return filas.map(armar);
}

/**
 * Suma imágenes de la biblioteca al producto, al final de la galería.
 *
 * Las que ya estaban se saltean en vez de fallar: elegir de nuevo una foto que
 * el producto ya tiene es un pedido sin efecto, no un error.
 */
export async function agregarImagenes(
  viewer: Viewer,
  productoId: string,
  mediaIds: string[]
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true },
  });
  if (!producto) throw new NotFoundError("Producto no encontrado");

  const ultima = await prisma.productoImagen.findFirst({
    where: { productoId },
    orderBy: { posicion: "desc" },
    select: { posicion: true },
  });
  let posicion = (ultima?.posicion ?? -1) + 1;

  await prisma.productoImagen.createMany({
    data: mediaIds.map((mediaId) => ({ productoId, mediaId, posicion: posicion++ })),
    skipDuplicates: true,
  });
  return listarImagenes(viewer, productoId);
}

/**
 * La saca **del producto**, no de la biblioteca: la foto sigue disponible para
 * otro. La variante que la señalaba queda sin foto propia
 * (`onDelete: SetNull`) y vuelve a mostrar la primera.
 */
export async function quitarImagen(
  viewer: Viewer,
  imagenId: string
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);
  const imagen = await prisma.productoImagen.findUnique({
    where: { id: imagenId },
    select: { id: true, productoId: true },
  });
  if (!imagen) throw new NotFoundError("Foto no encontrada");

  await prisma.productoImagen.delete({ where: { id: imagenId } });
  return listarImagenes(viewer, imagen.productoId);
}

/**
 * Cambia **qué archivo** usa una foto del producto, sin moverla de lugar.
 *
 * Es lo que hace falta al recortar: el recorte es una imagen nueva de la
 * biblioteca, y la galería tiene que pasar a mostrarla sin perder su posición
 * ni el vínculo de la variante que la había elegido. Borrar la fila y crear
 * otra la mandaría al final y dejaría a esa variante sin foto.
 */
export async function reemplazarImagen(
  viewer: Viewer,
  imagenId: string,
  mediaId: string
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);
  const imagen = await prisma.productoImagen.findUnique({
    where: { id: imagenId },
    select: { id: true, productoId: true },
  });
  if (!imagen) throw new NotFoundError("Foto no encontrada");

  await prisma.productoImagen.update({
    where: { id: imagenId },
    data: { mediaId },
  });
  return listarImagenes(viewer, imagen.productoId);
}

/** Reordena la galería. La primera es la que se muestra por defecto. */
export async function reordenarImagenes(
  viewer: Viewer,
  productoId: string,
  idsEnOrden: string[]
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);
  await prisma.$transaction(
    idsEnOrden.map((id, posicion) =>
      prisma.productoImagen.updateMany({
        where: { id, productoId },
        data: { posicion },
      })
    )
  );
  return listarImagenes(viewer, productoId);
}

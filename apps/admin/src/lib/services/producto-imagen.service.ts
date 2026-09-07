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

/**
 * Deja la galería **exactamente así**: estas fotos, en este orden.
 *
 * Es lo que guarda la ficha cuando alguien agrega, saca, reordena o recorta y
 * después aprieta *Guardar*. Antes cada una de esas acciones iba sola al
 * servidor, así que no había forma de hacer tres cambios y arrepentirse: ya
 * estaban hechos.
 *
 * **Reconcilia, no borra y recrea.** `Variante.imagenId` apunta a la fila de la
 * galería, así que recrearlas dejaría a cada variante sin la foto que había
 * elegido. Las que siguen conservan su id —y con él el vínculo— y solo se les
 * cambia la posición; el recorte llega como la misma fila apuntando a otro
 * archivo, que es justamente lo que lo deja en su lugar.
 */
export async function fijarImagenes(
  viewer: Viewer,
  productoId: string,
  entrada: Array<{ id?: string | null; mediaId: string }>
): Promise<ImagenDeProducto[]> {
  ensureAdmin(viewer);

  const actuales = await prisma.productoImagen.findMany({
    where: { productoId },
    select: { id: true, mediaId: true },
  });
  const porId = new Map(actuales.map((f) => [f.id, f]));

  // Qué filas sobreviven: las que llegaron con su id, y las que llegaron solo
  // con un `mediaId` que ya estaba (elegir de nuevo una foto que el producto
  // ya tiene no la duplica).
  const usadas = new Set<string>();
  const plan = entrada.map((x, posicion) => {
    const porMedia = actuales.find(
      (f) => f.mediaId === x.mediaId && !usadas.has(f.id)
    );
    const fila = x.id && porId.has(x.id) ? porId.get(x.id)! : porMedia;
    if (fila) usadas.add(fila.id);
    return { fila, mediaId: x.mediaId, posicion };
  });

  const sobran = actuales.filter((f) => !usadas.has(f.id)).map((f) => f.id);

  await prisma.$transaction([
    ...(sobran.length
      ? [prisma.productoImagen.deleteMany({ where: { id: { in: sobran } } })]
      : []),
    ...plan.map((p) =>
      p.fila
        ? prisma.productoImagen.update({
            where: { id: p.fila.id },
            data: { posicion: p.posicion, mediaId: p.mediaId },
          })
        : prisma.productoImagen.create({
            data: { productoId, mediaId: p.mediaId, posicion: p.posicion },
          })
    ),
  ]);

  return listarImagenes(viewer, productoId);
}

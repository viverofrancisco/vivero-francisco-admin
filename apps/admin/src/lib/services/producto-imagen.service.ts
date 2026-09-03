/**
 * Las fotos de un producto.
 *
 * **Del producto, no de la variante.** Lo que una foto muestra suele ser un eje
 * solo —el color— así que colgarla de cada combinación obligaría a subir la
 * misma imagen una vez por talle: con 3 colores × 4 tamaños, la del rojo iría
 * cuatro veces. La variante *elige* cuál de estas es la suya
 * (`Variante.imagenId`), y la que no elige ninguna muestra la primera.
 *
 * La subida es en dos pasos, como la de una visita: primero se piden URLs
 * firmadas, después se confirma lo que llegó. El navegador sube directo a R2,
 * así que un archivo grande nunca pasa por el servidor.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getUploadUrl, publicUrlForKey, deleteObjects } from "@/lib/s3";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

/** Cuántas fotos entran en un pedido de subida. */
export const MAX_IMAGENES_POR_SUBIDA = 10;

/**
 * URLs firmadas para subir.
 *
 * Solo imágenes: el `contentType` es lo que se firma y R2 guarda lo que llegue
 * con ese tipo, así que filtrarlo acá es lo único que impide que un pedido
 * armado a mano deje un ejecutable guardado como foto de producto.
 */
export async function urlsParaSubir(
  viewer: Viewer,
  productoId: string,
  archivos: { fileName: string; contentType: string }[]
) {
  ensureAdmin(viewer);
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true },
  });
  if (!producto) throw new NotFoundError("Producto no encontrado");

  if (archivos.length === 0 || archivos.length > MAX_IMAGENES_POR_SUBIDA) {
    throw new ValidationError(
      `Se pueden subir entre 1 y ${MAX_IMAGENES_POR_SUBIDA} fotos por vez.`
    );
  }
  for (const a of archivos) {
    if (!a.contentType.startsWith("image/")) {
      throw new ValidationError("Un producto solo lleva imágenes.");
    }
  }

  return Promise.all(
    archivos.map(async (a) => {
      const ext = a.fileName.split(".").pop() || "jpg";
      const key = `productos/${productoId}/${randomUUID()}.${ext}`;
      return { key, uploadUrl: await getUploadUrl(key, a.contentType) };
    })
  );
}

/** Confirma lo que ya está en R2 y lo guarda, al final de la galería. */
export async function confirmarImagenes(
  viewer: Viewer,
  productoId: string,
  imagenes: { key: string; alt?: string | null }[]
) {
  ensureAdmin(viewer);
  const ultima = await prisma.productoImagen.findFirst({
    where: { productoId },
    orderBy: { posicion: "desc" },
    select: { posicion: true },
  });
  let posicion = (ultima?.posicion ?? -1) + 1;

  await prisma.productoImagen.createMany({
    data: imagenes.map((i) => ({
      productoId,
      key: i.key,
      alt: i.alt?.trim() || null,
      posicion: posicion++,
    })),
  });
  return listarImagenes(viewer, productoId);
}

export async function listarImagenes(viewer: Viewer, productoId: string) {
  ensureAdmin(viewer);
  const imagenes = await prisma.productoImagen.findMany({
    where: { productoId },
    orderBy: { posicion: "asc" },
    select: { id: true, key: true, alt: true, posicion: true },
  });
  return imagenes.map((i) => ({ ...i, url: publicUrlForKey(i.key) }));
}

/**
 * Borra una foto. La variante que la señalaba queda sin foto propia
 * (`onDelete: SetNull`) y vuelve a mostrar la primera del producto.
 *
 * El objeto de R2 se borra después de la fila: al revés quedaría una fila
 * apuntando a un archivo que ya no existe, que es un link roto para siempre.
 */
export async function borrarImagen(viewer: Viewer, imagenId: string) {
  ensureAdmin(viewer);
  const imagen = await prisma.productoImagen.findUnique({
    where: { id: imagenId },
    select: { id: true, key: true, productoId: true },
  });
  if (!imagen) throw new NotFoundError("Foto no encontrada");

  await prisma.productoImagen.delete({ where: { id: imagenId } });
  await deleteObjects([imagen.key]);
  return listarImagenes(viewer, imagen.productoId);
}

/** Reordena la galería. La primera es la que se muestra por defecto. */
export async function reordenarImagenes(
  viewer: Viewer,
  productoId: string,
  idsEnOrden: string[]
) {
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

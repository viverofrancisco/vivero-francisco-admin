/**
 * La biblioteca de medios.
 *
 * Un archivo se sube **una vez** y se usa donde haga falta. Antes cada imagen
 * de producto era su propio objeto en R2, así que la misma foto en dos fichas
 * eran dos subidas: dos objetos que pagar y, peor, renombrar una dejaba a la
 * otra vieja.
 *
 * `Media` es el archivo; `ProductoImagen` dice qué archivos usa cada producto y
 * en qué orden. Sacar una foto de un producto no la borra de la biblioteca.
 */
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUploadUrl, publicUrlForKey, deleteObjects } from "@/lib/s3";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

/** Cuántos archivos entran en un pedido de subida. */
export const MAX_ARCHIVOS_POR_SUBIDA = 10;

export interface MediaResumen {
  id: string;
  url: string;
  nombre: string;
  alt: string | null;
  createdAt: Date;
  /** En cuántos productos se está usando. Cero se puede borrar sin pensar. */
  usos: number;
}

function conUrl(m: {
  id: string;
  key: string;
  nombre: string;
  alt: string | null;
  createdAt: Date;
  _count: { productos: number };
}): MediaResumen {
  return {
    id: m.id,
    url: publicUrlForKey(m.key),
    nombre: m.nombre,
    alt: m.alt,
    createdAt: m.createdAt,
    usos: m._count.productos,
  };
}

/**
 * La biblioteca, lo último primero.
 *
 * Con búsqueda por nombre porque es lo único con lo que se puede buscar una
 * imagen sin verla: el `key` es un uuid.
 */
export async function listarMedia(
  viewer: Viewer,
  { search, limit = 60 }: { search?: string; limit?: number } = {}
) {
  ensureAdmin(viewer);
  const where: Prisma.MediaWhereInput = search?.trim()
    ? { nombre: { contains: search.trim(), mode: "insensitive" } }
    : {};
  const items = await prisma.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      key: true,
      nombre: true,
      alt: true,
      createdAt: true,
      _count: { select: { productos: true } },
    },
  });
  return items.map(conUrl);
}

/**
 * URLs firmadas para subir a la biblioteca.
 *
 * Solo imágenes: el `contentType` es lo que se firma y R2 guarda lo que llegue
 * con ese tipo, así que filtrarlo acá es lo único que impide que un pedido
 * armado a mano deje un ejecutable guardado como foto.
 */
export async function urlsParaSubir(
  viewer: Viewer,
  archivos: { fileName: string; contentType: string }[]
) {
  ensureAdmin(viewer);
  if (archivos.length === 0 || archivos.length > MAX_ARCHIVOS_POR_SUBIDA) {
    throw new ValidationError(
      `Se pueden subir entre 1 y ${MAX_ARCHIVOS_POR_SUBIDA} archivos por vez.`
    );
  }
  for (const a of archivos) {
    if (!a.contentType.startsWith("image/")) {
      throw new ValidationError("La biblioteca solo lleva imágenes.");
    }
  }

  return Promise.all(
    archivos.map(async (a) => {
      const ext = a.fileName.split(".").pop() || "jpg";
      // Por fecha y no por producto: el archivo no es de nadie en particular.
      const key = `media/${new Date().getFullYear()}/${randomUUID()}.${ext}`;
      return { key, uploadUrl: await getUploadUrl(key, a.contentType) };
    })
  );
}

/** Anota en la biblioteca lo que ya llegó a R2. */
export async function confirmarSubida(
  viewer: Viewer,
  archivos: { key: string; nombre: string; contentType: string }[]
): Promise<MediaResumen[]> {
  ensureAdmin(viewer);
  const creadas = await prisma.$transaction(
    archivos.map((a) =>
      prisma.media.create({
        data: {
          key: a.key,
          nombre: a.nombre.trim() || a.key.split("/").pop()!,
          contentType: a.contentType,
          createdById: viewer.id,
        },
        select: {
          id: true,
          key: true,
          nombre: true,
          alt: true,
          createdAt: true,
          _count: { select: { productos: true } },
        },
      })
    )
  );
  return creadas.map(conUrl);
}

/** Cómo se llama y qué dice el alt. Lo demás de un archivo no se edita. */
export async function actualizarMedia(
  viewer: Viewer,
  mediaId: string,
  payload: { nombre?: string; alt?: string | null }
) {
  ensureAdmin(viewer);
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true },
  });
  if (!media) throw new NotFoundError("Imagen no encontrada");

  return prisma.media.update({
    where: { id: mediaId },
    data: {
      ...(payload.nombre !== undefined && payload.nombre.trim()
        ? { nombre: payload.nombre.trim() }
        : {}),
      ...(payload.alt !== undefined ? { alt: payload.alt?.trim() || null } : {}),
    },
  });
}

/**
 * La borra de la biblioteca **y de R2**.
 *
 * Solo si no la usa ningún producto: la FK es `Restrict`, así que la base lo
 * impediría igual, pero el mensaje tiene que decir cuántos la usan — un error
 * de foreign key no le explica nada a nadie.
 *
 * El objeto de R2 se borra después de la fila: al revés quedaría una fila
 * apuntando a un archivo que ya no existe, que es un link roto para siempre.
 */
export async function borrarMedia(viewer: Viewer, mediaId: string) {
  ensureAdmin(viewer);
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, key: true, _count: { select: { productos: true } } },
  });
  if (!media) throw new NotFoundError("Imagen no encontrada");

  if (media._count.productos > 0) {
    throw new ConflictError(
      `Esta imagen la usan ${media._count.productos} ${
        media._count.productos === 1 ? "producto" : "productos"
      }. Sacala de ahí antes de borrarla de la biblioteca.`
    );
  }

  await prisma.media.delete({ where: { id: mediaId } });
  await deleteObjects([media.key]);
}

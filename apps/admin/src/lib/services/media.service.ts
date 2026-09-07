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
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  getUploadUrl,
  publicUrlForKey,
  deleteObjects,
  s3,
  BUCKET_NAME,
} from "@/lib/s3";
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

export interface EdicionImagen {
  /** El rectángulo a conservar, en píxeles del original. */
  recorte?: { x: number; y: number; ancho: number; alto: number };
  /** A cuánto llevarla después de recortar. Mantiene la proporción del recorte. */
  redimensionar?: { ancho: number; alto: number };
  /** Recorta en círculo. Sale PNG, porque necesita transparencia. */
  circulo?: boolean;
}

/**
 * Recorta o redimensiona una imagen, **creando otra**.
 *
 * No pisa el archivo original y es a propósito: la biblioteca es compartida, y
 * la misma foto puede estar en un producto y en una categoría. Recortarla para
 * uno cambiaría la del otro sin que nadie se entere. El original queda, y quien
 * editó se queda apuntando al recorte.
 *
 * Se hace **en el servidor** y no en un canvas del navegador: leer el archivo
 * desde el navegador depende de que R2 mande los encabezados de CORS, y si no
 * lo hace el canvas queda "tainted" y `toBlob` falla sin decir por qué. Acá el
 * servidor ya tiene las credenciales para leerlo.
 */
export async function editarImagen(
  viewer: Viewer,
  mediaId: string,
  edicion: EdicionImagen
): Promise<MediaResumen> {
  ensureAdmin(viewer);
  const original = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, key: true, nombre: true, alt: true },
  });
  if (!original) throw new NotFoundError("Imagen no encontrada");

  if (!edicion.recorte && !edicion.redimensionar && !edicion.circulo) {
    throw new ValidationError("No hay nada que cambiarle a la imagen.");
  }

  const objeto = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: original.key })
  );
  const entrada = Buffer.from(await objeto.Body!.transformToByteArray());

  let img = sharp(entrada, { failOn: "none" }).rotate();
  const meta = await sharp(entrada).metadata();
  const anchoOriginal = meta.width ?? 0;
  const altoOriginal = meta.height ?? 0;

  if (edicion.recorte) {
    const r = edicion.recorte;
    // Se acota al tamaño real: un rectángulo que se pase de los bordes hace
    // que sharp tire, y lo que quiso decir quien lo mandó es "hasta el borde".
    const x = Math.max(0, Math.min(Math.round(r.x), anchoOriginal - 1));
    const y = Math.max(0, Math.min(Math.round(r.y), altoOriginal - 1));
    const width = Math.max(1, Math.min(Math.round(r.ancho), anchoOriginal - x));
    const height = Math.max(1, Math.min(Math.round(r.alto), altoOriginal - y));
    img = img.extract({ left: x, top: y, width, height });
  }

  if (edicion.redimensionar) {
    img = img.resize({
      width: Math.max(1, Math.round(edicion.redimensionar.ancho)),
      height: Math.max(1, Math.round(edicion.redimensionar.alto)),
      fit: "cover",
    });
  }

  let contentType = "image/jpeg";
  if (edicion.circulo) {
    // El círculo necesita transparencia, así que sale PNG aunque el original
    // fuera JPEG: un JPEG "circular" traería las esquinas en negro.
    const { width = 1, height = 1 } = await img
      .clone()
      .toBuffer({ resolveWithObject: true })
      .then((r) => r.info);
    const radio = Math.min(width, height) / 2;
    img = img.composite([
      {
        input: Buffer.from(
          `<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${radio}" /></svg>`
        ),
        blend: "dest-in",
      },
    ]);
    contentType = "image/png";
  }

  const salida =
    contentType === "image/png"
      ? await img.png().toBuffer()
      : await img.jpeg({ quality: 90 }).toBuffer();

  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `media/${new Date().getFullYear()}/${randomUUID()}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: salida,
      ContentType: contentType,
    })
  );

  const creada = await prisma.media.create({
    data: {
      key,
      // Se nota que es un recorte, y **numerado**: dos encuadres distintos del
      // mismo archivo con el mismo nombre no se distinguen en la biblioteca,
      // que es justo donde hay que elegir entre ellos.
      nombre: await nombreDeRecorte(original.nombre, ext),
      alt: original.alt,
      contentType,
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
  });
  return conUrl(creada);
}

/**
 * "abono.jpg" → "abono (recorte).jpg", y si ya existe, "(recorte 2)".
 *
 * Sin encadenar: recortar un recorte da "(recorte 2)" y no
 * "(recorte) (recorte)". Y sin número el segundo encuadre del mismo archivo
 * quedaba con el nombre del primero, que es lo que hace imposible elegir entre
 * los dos en la biblioteca.
 */
async function nombreDeRecorte(nombre: string, ext: string): Promise<string> {
  const sinExt = nombre.replace(/\.[^.]+$/, "");
  const base = sinExt.replace(/ \(recorte( \d+)?\)$/, "");

  // Los que ya empiezan igual, para saber en qué número va la serie. No es un
  // índice único —dos nombres iguales no rompen nada— así que una carrera acá
  // deja dos "(recorte 3)" y no un error.
  const parecidos = await prisma.media.findMany({
    where: { nombre: { startsWith: `${base} (recorte` } },
    select: { nombre: true },
  });
  if (parecidos.length === 0) return `${base} (recorte).${ext}`;

  const usados = new Set(
    parecidos.map((m) => {
      const encontrado = m.nombre.match(/ \(recorte( (\d+))?\)/);
      return encontrado?.[2] ? Number(encontrado[2]) : 1;
    })
  );
  let n = 2;
  while (usados.has(n)) n++;
  return `${base} (recorte ${n}).${ext}`;
}

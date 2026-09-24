import sharp from "sharp";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_NAME, publicUrlForKey, s3 } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

/**
 * Las tres versiones de una foto de chat, para no bajar seis megas a un
 * teléfono que la va a mostrar en una burbuja de 200 px.
 *
 * El original queda como llegó —es lo que alguien mandó— y al lado se
 * escriben tres JPEG: **móvil** (480 px de lado mayor, la burbuja y la
 * grilla), **tablet** (1024, la foto abierta en un teléfono o una tablet) y
 * **escritorio** (2048, abierta en una pantalla grande). Cada pantalla pide
 * la que le toca (`urlParaMiniatura`, `urlParaVerGrande` en `@vivero/shared`)
 * y cae al original mientras las versiones no estén.
 *
 * Se generan **después de contestar** el envío (`after` de Next en la ruta):
 * la foto sube directo a R2 con una URL firmada, así que el servidor no la ve
 * hasta que el mensaje existe, y hacerlo antes de responder sumaría segundos
 * a un ✓ que tiene que ser instantáneo. El sondeo del chat trae las URLs
 * nuevas en la siguiente vuelta.
 *
 * Los videos no se tocan: transcodificar pide ffmpeg y minutos de función,
 * y no hay ninguno de los dos acá. Los documentos tampoco: un PDF no se
 * comprime sin Ghostscript, y un Office o un ZIP ya vienen comprimidos.
 */
export const LADOS = { movil: 480, tablet: 1024, escritorio: 2048 } as const;

export async function generarVariantesDeMensaje(mensajeId: string) {
  const adjuntos = await prisma.chatAdjunto.findMany({
    where: { mensajeId, tipo: "imagen", urlMovil: null },
    select: { id: true, key: true },
  });
  for (const a of adjuntos) {
    try {
      await generarVariantes(a.id, a.key);
    } catch (error) {
      // Una foto que no se dejó procesar sigue viéndose con el original.
      console.error("No se pudieron generar las versiones de", a.key, error);
    }
  }
}

async function generarVariantes(adjuntoId: string, key: string) {
  const objeto = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  if (!objeto.Body) throw new Error("R2 devolvió el objeto sin cuerpo");
  const original = Buffer.from(await objeto.Body.transformToByteArray());
  const sinExtension = key.replace(/\.[^./]+$/, "");
  const urls: Partial<Record<keyof typeof LADOS, string>> = {};

  for (const [nombre, lado] of Object.entries(LADOS) as [keyof typeof LADOS, number][]) {
    const cuerpo = await sharp(original)
      // La orientación del EXIF se aplica de verdad: un teléfono guarda la
      // foto acostada y el ángulo aparte, y sin esto la versión sale girada.
      .rotate()
      .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
      // Sobre blanco: un PNG transparente saldría negro en JPEG.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const claveVariante = `${sinExtension}-${nombre}.jpg`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: claveVariante,
        Body: cuerpo,
        ContentType: "image/jpeg",
        // La clave lleva un uuid: nunca cambia de contenido, así que el
        // navegador y el teléfono pueden guardarla para siempre.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    urls[nombre] = publicUrlForKey(claveVariante);
  }

  await prisma.chatAdjunto.update({
    where: { id: adjuntoId },
    data: {
      urlMovil: urls.movil,
      urlTablet: urls.tablet,
      urlEscritorio: urls.escritorio,
    },
  });
}

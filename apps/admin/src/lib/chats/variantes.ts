import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET_NAME, publicUrlForKey, s3 } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

/**
 * Las versiones livianas de lo que se manda en un chat, para no bajar seis
 * megas —o sesenta, si es un video— a un teléfono que lo va a mostrar en una
 * burbuja de 200 px.
 *
 * **Fotos**: el original queda como llegó —es lo que alguien mandó— y al lado
 * se escriben tres JPEG: **móvil** (480 px de lado mayor, la burbuja y la
 * grilla), **tablet** (1024, la foto abierta en un teléfono o una tablet) y
 * **escritorio** (2048, abierta en una pantalla grande).
 *
 * **Videos**: un MP4 de 720p y ~1,5 Mbps (H.264 + AAC, `faststart` para que
 * empiece antes de bajarse entero), que es lo que un teléfono reproduce sin
 * quedarse cargando, guardado como `urlMovil`; y un **póster** JPEG del
 * segundo uno (`posterUrl`) para que la burbuja muestre un cuadro y no un
 * recuadro oscuro. El escritorio sigue viendo el original. Es `ffmpeg-static`
 * —el binario viaja en `node_modules` y `next.config.ts` lo traza para la
 * función—, a `preset veryfast`: un minuto de video de teléfono son unos
 * veinte a sesenta segundos de CPU, dentro de lo que la función tiene.
 *
 * Cada pantalla pide la que le toca (`urlParaMiniatura`, `urlParaVerGrande`
 * en `@vivero/shared`) y cae al original mientras las versiones no estén.
 *
 * Se generan **después de contestar** el envío (`after` de Next en la ruta):
 * el archivo sube directo a R2 con una URL firmada, así que el servidor no lo
 * ve hasta que el mensaje existe, y hacerlo antes de responder sumaría
 * segundos —o un minuto— a un ✓ que tiene que ser instantáneo. El sondeo del
 * chat trae las URLs nuevas en la siguiente vuelta.
 *
 * Los documentos no se comprimen: un PDF no se achica sin Ghostscript, y un
 * Office o un ZIP ya vienen comprimidos.
 */
export const LADOS = { movil: 480, tablet: 1024, escritorio: 2048 } as const;

/** Un video más largo que esto no se transcodifica: no entra en la función. */
const MAXIMO_FFMPEG_MS = 240_000;

export async function generarVariantesDeMensaje(mensajeId: string) {
  const adjuntos = await prisma.chatAdjunto.findMany({
    where: { mensajeId, tipo: { in: ["imagen", "video"] }, urlMovil: null },
    select: { id: true, key: true, tipo: true },
  });
  for (const a of adjuntos) {
    try {
      if (a.tipo === "video") await generarVersionDeVideo(a.id, a.key);
      else await generarVariantesDeFoto(a.id, a.key);
    } catch (error) {
      // Lo que no se dejó procesar sigue viéndose con el original.
      console.error("No se pudieron generar las versiones de", a.key, error);
    }
  }
}

async function bajar(key: string): Promise<Buffer> {
  const objeto = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  if (!objeto.Body) throw new Error("R2 devolvió el objeto sin cuerpo");
  return Buffer.from(await objeto.Body.transformToByteArray());
}

async function subir(key: string, cuerpo: Buffer, contentType: string): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: cuerpo,
      ContentType: contentType,
      // La clave lleva un uuid: nunca cambia de contenido, así que el
      // navegador y el teléfono pueden guardarla para siempre.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return publicUrlForKey(key);
}

async function generarVariantesDeFoto(adjuntoId: string, key: string) {
  const original = await bajar(key);
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
    urls[nombre] = await subir(`${sinExtension}-${nombre}.jpg`, cuerpo, "image/jpeg");
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

/** `ffmpeg` con sus argumentos, con tiempo límite. Devuelve lo que dijo por stderr si falla. */
function ffmpeg(args: string[]): Promise<void> {
  const binario = ffmpegPath;
  if (!binario) return Promise.reject(new Error("ffmpeg-static no trae binario para esta plataforma"));
  return new Promise((resolver, rechazar) => {
    execFile(
      binario,
      ["-hide_banner", "-loglevel", "error", "-y", ...args],
      { timeout: MAXIMO_FFMPEG_MS, maxBuffer: 4 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) rechazar(new Error(`ffmpeg: ${stderr || error.message}`));
        else resolver();
      }
    );
  });
}

async function generarVersionDeVideo(adjuntoId: string, key: string) {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "video-"));
  const entrada = path.join(carpeta, `original${path.extname(key) || ".mp4"}`);
  const salida = path.join(carpeta, "movil.mp4");
  const poster = path.join(carpeta, "poster.jpg");
  try {
    await fs.writeFile(entrada, await bajar(key));
    // 720p de lado corto como máximo, sin agrandar; el `-2` mantiene el otro
    // lado par, que H.264 exige. `yuv420p` es lo que reproduce cualquier
    // teléfono; sin él un video de iPhone en 10 bits sale negro en Android.
    await ffmpeg([
      "-i", entrada,
      "-vf", "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
      "-pix_fmt", "yuv420p", "-profile:v", "main",
      "-c:a", "aac", "-b:a", "96k", "-ac", "2",
      "-movflags", "+faststart",
      salida,
    ]);
    // El póster: el cuadro del segundo uno, a 480 px, como la miniatura de una foto.
    await ffmpeg([
      "-ss", "1", "-i", entrada, "-frames:v", "1",
      "-vf", "scale='if(gt(iw,ih),-2,min(480,iw))':'if(gt(iw,ih),min(480,ih),-2)'",
      "-q:v", "4", poster,
    ]).catch(() =>
      // Un video de menos de un segundo no tiene segundo uno: el primer cuadro.
      ffmpeg(["-i", entrada, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", poster])
    );
    const sinExtension = key.replace(/\.[^./]+$/, "");
    const urlMovil = await subir(`${sinExtension}-movil.mp4`, await fs.readFile(salida), "video/mp4");
    const posterUrl = await subir(`${sinExtension}-poster.jpg`, await fs.readFile(poster), "image/jpeg");
    await prisma.chatAdjunto.update({
      where: { id: adjuntoId },
      data: { urlMovil, posterUrl },
    });
  } finally {
    await fs.rm(carpeta, { recursive: true, force: true }).catch(() => {});
  }
}

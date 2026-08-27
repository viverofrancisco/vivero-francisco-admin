import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3-compatible). Region is always "auto" for R2.
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET!;

// Public base URL where uploaded objects are served (r2.dev subdomain or
// custom CDN domain). Trailing slash trimmed so callers can join with `/key`.
const PUBLIC_URL_BASE = (process.env.S3_PUBLIC_URL_BASE ?? "").replace(/\/+$/, "");

export function publicUrlForKey(key: string): string {
  if (!PUBLIC_URL_BASE) {
    throw new Error("S3_PUBLIC_URL_BASE is not configured");
  }
  return `${PUBLIC_URL_BASE}/${key}`;
}

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

/**
 * URL firmada para bajar un objeto.
 *
 * Con `nombreArchivo`, R2 responde con `Content-Disposition: attachment`, que
 * es lo único que hace que el navegador **guarde** el archivo en vez de
 * abrirlo. El atributo `download` de un `<a>` no sirve acá: los navegadores lo
 * ignoran cuando el archivo está en otro dominio, y el nuestro vive en R2.
 */
export async function getDownloadUrl(
  key: string,
  nombreArchivo?: string
) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ...(nombreArchivo
      ? { ResponseContentDisposition: disposicion(nombreArchivo) }
      : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/**
 * `Content-Disposition` con el nombre en las dos formas que pide la RFC 5987:
 * una ASCII de respaldo y otra en UTF-8. Sin la segunda, "Jardín" llega como
 * "Jard_n"; sin la primera, los clientes viejos no entienden nada.
 */
function disposicion(nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    nombre
  )}`;
}

/**
 * Borra objetos del bucket. Best-effort: nunca tira.
 *
 * Va después de borrar la fila, no antes. Si falla el borrado en R2 queda un
 * archivo de más —recuperable, cuesta centavos—; al revés quedaría una fila
 * apuntando a un archivo que ya no existe, que es un link roto para siempre.
 *
 * En tandas de 1000, que es el máximo por llamada de la API S3.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  const limpias = keys.filter(Boolean);
  if (limpias.length === 0) return;
  for (let i = 0; i < limpias.length; i += 1000) {
    const tanda = limpias.slice(i, i + 1000);
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: { Objects: tanda.map((Key) => ({ Key })), Quiet: true },
        })
      );
    } catch (error) {
      console.error("No pudimos borrar objetos de R2", tanda, error);
    }
  }
}

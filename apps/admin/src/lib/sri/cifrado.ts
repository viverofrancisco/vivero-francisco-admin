/**
 * Cifrado de los certificados de firma electrónica.
 *
 * Un `.p12` es una **clave privada** que firma documentos tributarios en nombre
 * de la empresa: quien lo tiene puede emitir facturas a nombre de ese RUC. Por
 * eso no se guarda tal cual en la base, ni siquiera en una columna que "solo
 * lee el servidor": si alguien se lleva un dump, se lleva la firma.
 *
 * AES-256-GCM, que además de cifrar **autentica**: un byte cambiado en la base
 * hace fallar el descifrado en vez de devolver basura que después rompe al
 * firmar. La clave vive en el entorno (`FIRMA_ENCRYPTION_KEY`), fuera de la
 * base, para que ninguna de las dos mitades sirva sola.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function clave(): Buffer {
  const bruta = process.env.FIRMA_ENCRYPTION_KEY;
  if (!bruta) {
    throw new Error(
      "Falta FIRMA_ENCRYPTION_KEY: sin esa clave no se puede guardar ni usar un certificado de firma."
    );
  }
  // SHA-256 del secreto: acepta una frase de cualquier largo y siempre entrega
  // los 32 bytes que pide AES-256.
  return createHash("sha256").update(bruta).digest();
}

/**
 * `iv (12) | tag (16) | ciphertext`, todo junto.
 *
 * Devuelve `Uint8Array` y no `Buffer` porque es lo que espera Prisma en una
 * columna `Bytes`: un `Buffer` de Node ya no le encaja al tipo generado.
 */
export function cifrar(claro: Buffer | string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([
    cipher.update(typeof claro === "string" ? Buffer.from(claro, "utf8") : claro),
    cipher.final(),
  ]);
  const todo = Buffer.concat([iv, cipher.getAuthTag(), datos]);
  // Copia a un `ArrayBuffer` propio: el tipo `Bytes` de Prisma pide justo eso,
  // y el `Buffer` de Node puede estar apoyado en un buffer compartido.
  const salida = new Uint8Array(new ArrayBuffer(todo.length));
  salida.set(todo);
  return salida;
}

export function descifrar(guardado: Buffer | Uint8Array): Buffer {
  const buf = Buffer.from(guardado);
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)),
    decipher.final(),
  ]);
}

export const descifrarTexto = (guardado: Buffer | Uint8Array): string =>
  descifrar(guardado).toString("utf8");

/** Si la clave está configurada. Para avisar en pantalla en vez de explotar. */
export const cifradoConfigurado = (): boolean =>
  Boolean(process.env.FIRMA_ENCRYPTION_KEY);

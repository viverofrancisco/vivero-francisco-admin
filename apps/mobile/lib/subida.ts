import * as FileSystem from "expo-file-system/legacy";

/** El archivo local no está donde la cola dice: no hay nada que reintentar. */
export class ArchivoAusente extends Error {
  constructor(uri: string) {
    super(`No existe ${uri}`);
  }
}

/**
 * Sube un archivo del teléfono a una URL firmada, **por su ruta**.
 *
 * Es `uploadAsync` de expo-file-system y no `fetch(uri).blob()` + `fetch(PUT)`:
 * el nativo lee el archivo y lo manda en streaming, sin pasar 4 MB por un
 * blob en JavaScript, y no depende de que el `fetch` de React Native sepa
 * leer un `file://` —que es lo que falló con las fotos convertidas de la
 * galería propia, con el archivo presente en la caché—. Devuelve el estado
 * HTTP; el que llama decide qué hacer con un 403 (firma vencida) o un 5xx.
 */
export async function subirArchivoLocal(
  uri: string,
  uploadUrl: string,
  contentType: string
): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new ArchivoAusente(uri);
  const r = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": contentType },
  });
  return r.status;
}

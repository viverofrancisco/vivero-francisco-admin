import * as MediaLibrary from "expo-media-library";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

/**
 * Un archivo del teléfono listo para subir: dónde está, cómo se llama y de
 * qué tipo es. Es la forma común de lo que sale de la cámara y de la galería,
 * para que las pantallas no tengan que distinguir de dónde vino cada foto.
 */
export interface ArchivoLocal {
  uri: string;
  fileName: string;
  contentType: string;
  tipo: "imagen" | "video";
  /** De la galería del teléfono, si salió de ahí: con esto vuelve a salir marcado. */
  assetId?: string;
}

/** Uno de la galería: siempre sabe de qué foto salió. */
export interface ArchivoDeGaleria extends ArchivoLocal {
  assetId: string;
}

/**
 * Lo que devuelve la cámara del sistema (`expo-image-picker`), con nombre y
 * tipo resueltos. La cámara sigue siendo la del sistema: no hay galería que
 * dibujar ahí.
 */
export function archivoDeAssetDeCamara(a: ImagePickerAsset): ArchivoLocal {
  const esVideo = a.type === "video";
  return {
    uri: a.uri,
    fileName:
      a.fileName ?? a.uri.split("/").pop() ?? `${esVideo ? "video" : "foto"}-${Date.now()}.${esVideo ? "mp4" : "jpg"}`,
    contentType: a.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
    tipo: esVideo ? "video" : "imagen",
  };
}

const CONTENT_TYPE_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
  webm: "video/webm",
};

function extensionDe(nombre: string): string {
  return nombre.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Convierte lo elegido en la galería en un archivo que la cola pueda subir.
 *
 * La galería devuelve un `ph://` en iOS y un `content://` en Android, que no
 * son archivos: `getAssetInfoAsync` da el `localUri` real. Y una **foto se
 * vuelve a codificar como JPEG** siempre, por dos motivos que el selector del
 * sistema resolvía solo: un iPhone guarda HEIC, que el servidor no sabe leer
 * (sharp sin libheif) ni el portal mostrar salvo en Safari; y el archivo
 * original de la galería es el de 12 megapíxeles, que el selector del
 * sistema ya bajaba con `quality`. El resultado queda en la caché de la app,
 * como antes. Un video se manda tal cual: el servidor le hace el 720p.
 */
export async function archivoDeAssetDeGaleria(
  asset: MediaLibrary.Asset
): Promise<ArchivoDeGaleria> {
  const info = await MediaLibrary.getAssetInfoAsync(asset.id, {
    shouldDownloadFromNetwork: true,
  });
  const origen = info.localUri ?? asset.uri;
  const nombreOriginal = asset.filename || origen.split("/").pop() || "archivo";

  if (asset.mediaType === "video") {
    return {
      uri: origen,
      fileName: nombreOriginal,
      contentType:
        CONTENT_TYPE_POR_EXTENSION[extensionDe(nombreOriginal)] ?? "video/mp4",
      tipo: "video",
      assetId: asset.id,
    };
  }

  const jpeg = await manipulateAsync(origen, [], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  const base = nombreOriginal.replace(/\.[^.]+$/, "") || `foto-${Date.now()}`;
  return {
    uri: jpeg.uri,
    fileName: `${base}.jpg`,
    contentType: "image/jpeg",
    tipo: "imagen",
    assetId: asset.id,
  };
}

/** "1:05" para el rótulo de un video. */
export function duracionCorta(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

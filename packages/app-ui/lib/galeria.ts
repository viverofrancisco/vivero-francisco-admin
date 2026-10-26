import { Platform } from "react-native";
import Constants from "expo-constants";
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

/**
 * Lo que devuelve `SelectorDeGaleria`. En iOS siempre sabe de qué foto salió
 * (`assetId`), y con eso vuelve a salir marcada. En Android **no**: ahí se usa
 * el selector de fotos del sistema, que no da un id de la galería, y lo que
 * trae se suma a la bandeja como lo de la cámara (ver `SelectorDeGaleria`).
 */
export type ArchivoDeGaleria = ArchivoLocal;

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
 *
 * `sinConvertir` se salta el JPEG: es para quien pasa la foto después por
 * un editor que ya la vuelve a codificar (la app del equipo), porque hacerlo
 * dos veces con una de 12 megapíxeles son segundos de espera al tocarla.
 */
export async function archivoDeAssetDeGaleria(
  asset: MediaLibrary.Asset,
  { sinConvertir = false }: { sinConvertir?: boolean } = {}
): Promise<ArchivoLocal & { assetId: string }> {
  // En Android el `uri` del asset ya es el archivo (`file:///storage/…`), y
  // `getAssetInfoAsync` lee el EXIF, que pide ACCESS_MEDIA_LOCATION: un
  // permiso que la app del equipo bloquea y que no necesitamos.
  const origen =
    Platform.OS === "android"
      ? asset.uri
      : ((
          await MediaLibrary.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: true })
        ).localUri ?? asset.uri);
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

  if (sinConvertir) {
    return {
      uri: origen,
      fileName: nombreOriginal,
      contentType: CONTENT_TYPE_POR_EXTENSION[extensionDe(nombreOriginal)] ?? "image/jpeg",
      tipo: "imagen",
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

/**
 * Lo que trae el selector de fotos del sistema (Android), como archivo listo
 * para subir y **sin `assetId`**. Una foto se vuelve a codificar como JPEG por
 * lo mismo que en `archivoDeAssetDeGaleria`; un video va tal cual.
 */
export async function archivoDeAssetDelSelector(a: ImagePickerAsset): Promise<ArchivoLocal> {
  const archivo = archivoDeAssetDeCamara(a);
  if (archivo.tipo === "video") return archivo;
  const jpeg = await manipulateAsync(a.uri, [], { compress: 0.8, format: SaveFormat.JPEG });
  const base = archivo.fileName.replace(/\.[^.]+$/, "") || `foto-${Date.now()}`;
  return { uri: jpeg.uri, fileName: `${base}.jpg`, contentType: "image/jpeg", tipo: "imagen" };
}

/**
 * Si esta app dibuja su propia galería o usa el selector del sistema.
 *
 * Lo decide el `app.json` de cada app, no la plataforma sola: en Android es el
 * selector del sistema solo si la app bloquea `READ_MEDIA_IMAGES`
 * (`android.blockedPermissions`), porque sin ese permiso no hay galería que
 * leer. Google Play lo exigió a la app del equipo el 23-oct-2026; la de
 * clientes ya estaba aprobada con el permiso y se dejó como estaba. Con la
 * galería propia vienen también las *sacadas durante la visita*.
 */
export const GALERIA_PROPIA = !(
  Platform.OS === "android" &&
  (Constants.expoConfig?.android?.blockedPermissions ?? []).includes(
    "android.permission.READ_MEDIA_IMAGES"
  )
);

/**
 * Cuándo se sacaron las fotos que se sugieren para una visita: **desde que la
 * persona marcó su entrada** hasta su salida —con un margen de quince minutos,
 * la foto del "después" se saca saliendo— o, si sigue adentro, hasta ahora.
 */
export interface VentanaDeFotos {
  desde: string;
  hasta?: string | null;
}

const MARGEN_DESPUES_DE_SALIR_MS = 15 * 60 * 1000;

export function limitesDeLaVentana(v: VentanaDeFotos): { desde: number; hasta: number } {
  const desde = new Date(v.desde).getTime();
  const hasta = v.hasta
    ? new Date(v.hasta).getTime() + MARGEN_DESPUES_DE_SALIR_MS
    : Date.now();
  return { desde, hasta: Math.min(hasta, Date.now()) };
}

/**
 * Las fotos (y videos, si se piden) del teléfono sacadas dentro de la ventana,
 * las más nuevas primero. **No pide permiso**: si todavía no se dio, devuelve
 * vacío, porque el aviso de cuántas hay no puede ser lo que dispara la
 * ventana del sistema; eso pasa al abrir la galería.
 */
export async function fotosDeLaVentana(
  v: VentanaDeFotos,
  { conVideos = true, pedirPermiso = false, cuantas = 100 } = {}
): Promise<{ assets: MediaLibrary.Asset[]; total: number }> {
  if (!GALERIA_PROPIA) return { assets: [], total: 0 };
  const permiso = pedirPermiso
    ? await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"])
    : await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
  if (!permiso.granted) return { assets: [], total: 0 };
  const { desde, hasta } = limitesDeLaVentana(v);
  if (!(hasta > desde)) return { assets: [], total: 0 };
  const pagina = await MediaLibrary.getAssetsAsync({
    first: cuantas,
    createdAfter: desde,
    createdBefore: hasta,
    mediaType: conVideos
      ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
      : [MediaLibrary.MediaType.photo],
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
  return { assets: pagina.assets, total: pagina.totalCount };
}

/** "1:05" para el rótulo de un video. */
export function duracionCorta(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

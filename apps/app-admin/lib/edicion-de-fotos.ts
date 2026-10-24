import { Image } from "react-native";
import { FlipType, SaveFormat, manipulateAsync, type Action } from "expo-image-manipulator";
import type { ArchivoLocal } from "@vivero/app-ui/lib/galeria";
import type { EdicionDeFoto } from "@/components/informes/RecortarFoto";

/**
 * Lo que se le dibuja encima a una foto en el editor (`EditorDeFotos`).
 *
 * Todo en **fracciones** de la foto (0–1), no en puntos de la pantalla: el
 * mismo trazo se dibuja en el editor, a lo ancho del teléfono, y al aplanar,
 * a la resolución de la foto, sin convertir nada.
 */
export interface Trazo {
  color: string;
  /** Grosor, en fracción del ancho de la foto. */
  grosor: number;
  puntos: { x: number; y: number }[];
}

export interface TextoEnFoto {
  id: string;
  texto: string;
  color: string;
  /** El centro del texto. */
  x: number;
  y: number;
  /** Tamaño de la letra, en fracción del ancho de la foto. */
  tamano: number;
}

/** Una foto (o un video) en el editor, con lo que se le hizo. */
export interface FotoEnEdicion {
  /** El archivo tal como llegó, ya recortado si se recortó. */
  archivo: ArchivoLocal;
  ancho: number;
  alto: number;
  trazos: Trazo[];
  textos: TextoEnFoto[];
}

export const tieneDibujos = (f: FotoEnEdicion) => f.trazos.length > 0 || f.textos.length > 0;

/** El lado largo de una foto sin HD. Las variantes del servidor llegan a 2048. */
export const LADO_ESTANDAR = 2048;

/** Las medidas de una foto, para dibujarla en proporción. */
export function medidasDe(uri: string): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolver) => {
    Image.getSize(
      uri,
      (ancho, alto) => resolver({ ancho, alto }),
      () => resolver({ ancho: 1, alto: 1 })
    );
  });
}

export async function enEdicion(archivo: ArchivoLocal): Promise<FotoEnEdicion> {
  const { ancho, alto } =
    archivo.tipo === "imagen" ? await medidasDe(archivo.uri) : { ancho: 9, alto: 16 };
  return { archivo, ancho, alto, trazos: [], textos: [] };
}

/**
 * El recorte de `RecortarFoto`, aplicado en el teléfono: voltear, girar y
 * recortar, en ese orden —el mismo de sharp en el servidor, que es en el que
 * la pantalla dibuja el recuadro—.
 */
export async function recortar(uri: string, edicion: EdicionDeFoto): Promise<string> {
  const acciones: Action[] = [];
  if (edicion.voltear) acciones.push({ flip: FlipType.Horizontal });
  if (edicion.rotar) acciones.push({ rotate: edicion.rotar });
  acciones.push({
    crop: {
      originX: edicion.recorte.x,
      originY: edicion.recorte.y,
      width: edicion.recorte.ancho,
      height: edicion.recorte.alto,
    },
  });
  const r = await manipulateAsync(uri, acciones, { compress: 0.95, format: SaveFormat.JPEG });
  return r.uri;
}

/**
 * La calidad de salida: **estándar** baja el lado largo a `LADO_ESTANDAR`
 * (lo que el servidor guarda igual para mostrar), **HD** deja la foto entera.
 * Un video no se toca.
 */
export async function conCalidad(
  archivo: ArchivoLocal,
  hd: boolean
): Promise<ArchivoLocal> {
  if (archivo.tipo !== "imagen") return archivo;
  const { ancho, alto } = await medidasDe(archivo.uri);
  const largo = Math.max(ancho, alto);
  const acciones: Action[] =
    !hd && largo > LADO_ESTANDAR
      ? [{ resize: ancho >= alto ? { width: LADO_ESTANDAR } : { height: LADO_ESTANDAR } }]
      : [];
  const r = await manipulateAsync(archivo.uri, acciones, {
    compress: hd ? 0.92 : 0.8,
    format: SaveFormat.JPEG,
  });
  const base = archivo.fileName.replace(/\.[^.]+$/, "") || `foto-${Date.now()}`;
  return { ...archivo, uri: r.uri, fileName: `${base}.jpg`, contentType: "image/jpeg" };
}

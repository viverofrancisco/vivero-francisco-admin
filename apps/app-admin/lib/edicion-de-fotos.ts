import { Image, Platform } from "react-native";
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

export type AlineacionDeTexto = "left" | "center" | "right";
/**
 * El fondo del texto, los tres de WhatsApp: ninguno (letra con sombra), el
 * color lleno con la letra en contraste, o el color translúcido.
 */
export type FondoDeTexto = "ninguno" | "solido" | "suave";

export interface TextoEnFoto {
  id: string;
  texto: string;
  color: string;
  /** Dónde está el color en la barra (0–1), para volver a abrirlo ahí. */
  posicionDelColor: number;
  /** El centro del texto. */
  x: number;
  y: number;
  /** Tamaño de la letra, en fracción del ancho de la foto. */
  tamano: number;
  /** Índice en `FUENTES`. */
  fuente: number;
  alineacion: AlineacionDeTexto;
  fondo: FondoDeTexto;
}

/**
 * Las letras de la fila de WhatsApp, con lo que trae el sistema —ninguna se
 * descarga—: la de siempre en negrita, una con serifa, una manuscrita, una
 * angosta, una de máquina, la fina y la cursiva gruesa.
 */
export const FUENTES: {
  fontFamily?: string;
  fontWeight?: "400" | "700" | "800";
  fontStyle?: "italic";
}[] = [
  { fontWeight: "700" },
  { fontFamily: Platform.select({ ios: "Georgia", default: "serif" }) },
  { fontFamily: Platform.select({ ios: "SnellRoundhand", default: "cursive" }) },
  {
    fontFamily: Platform.select({ ios: "AvenirNextCondensed-Heavy", default: "sans-serif-condensed" }),
    fontWeight: "700",
  },
  { fontFamily: Platform.select({ ios: "Courier New", default: "monospace" }), fontWeight: "700" },
  { fontWeight: "400" },
  { fontWeight: "800", fontStyle: "italic" },
];

/** La parte de arriba de la barra de colores va de blanco a negro. */
const GRISES = 0.15;

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * El color en ese punto de la barra (0 arriba, 1 abajo): blanco a negro y
 * después el arco iris de rojo a rosa, como la de WhatsApp.
 */
export function colorEnLaBarra(posicion: number): string {
  const v = Math.min(Math.max(posicion, 0), 1);
  if (v < GRISES) {
    const g = 255 * (1 - v / GRISES);
    return hex(g, g, g);
  }
  const h = ((v - GRISES) / (1 - GRISES)) * 330;
  // HSL con saturación 0,9 y luz 0,55.
  const s = 0.9;
  const l = 0.55;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return hex(f(0), f(8), f(4));
}

/** Dónde queda el rojo en la barra: el primer color después de los grises. */
export const POSICION_DEL_ROJO = GRISES;

function esClaro(color: string): boolean {
  const n = parseInt(color.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** El color de la letra y el del fondo, según el fondo elegido. */
export function coloresDelTexto(t: Pick<TextoEnFoto, "color" | "fondo">): {
  letra: string;
  fondo: string | null;
} {
  if (t.fondo === "ninguno") return { letra: t.color, fondo: null };
  if (t.fondo === "solido") return { letra: esClaro(t.color) ? "#000000" : "#ffffff", fondo: t.color };
  return { letra: esClaro(t.color) ? "#000000" : "#ffffff", fondo: `${t.color}99` };
}

/** Una foto (o un video) en el editor, con lo que se le hizo. */
export interface FotoEnEdicion {
  /** La `uri` con la que llegó: la identifica aunque se recorte (la cámara guarda lo editado por ella). */
  origen: string;
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
  return { origen: archivo.uri, archivo, ancho, alto, trazos: [], textos: [] };
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

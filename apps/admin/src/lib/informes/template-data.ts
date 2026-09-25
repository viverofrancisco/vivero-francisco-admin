// Plain data the PDF renderer needs. Keep this file dependency-free so it
// can be imported from both the service (server) and any preview UI.

import type { LineaEncabezado } from "./encabezado";

/** Cuántas fotos entran en una fila. Es la palanca de densidad de la sección. */
export type FotosPorFila = 2 | 3 | 4 | 5 | 6;

export const FOTOS_POR_FILA: FotosPorFila[] = [2, 3, 4, 5, 6];

export function esFotosPorFila(v: unknown): v is FotosPorFila {
  return v === 2 || v === 3 || v === 4 || v === 5 || v === 6;
}

/** Hacia dónde se arriman las fotos de una fila incompleta. */
export type AlineacionDeFotos = "IZQUIERDA" | "CENTRO" | "DERECHA";

export function esAlineacionDeFotos(v: unknown): v is AlineacionDeFotos {
  return v === "IZQUIERDA" || v === "CENTRO" || v === "DERECHA";
}

export interface InformeRenderSeccion {
  titulo: string;
  descripcion: string | null;
  // Fotos resueltas a buffers de imagen ANTES de pasar al renderer.
  // (react-pdf no descarga remote URLs de manera confiable en serverless.)
  fotos: { id: string; bytes: Uint8Array; mimeType: string }[];
  /** Empieza en una hoja nueva. */
  saltoDePagina: boolean;
  fotosPorFila: FotosPorFila;
  fotosAlineacion: AlineacionDeFotos;
}

export interface InformeRenderFirmante {
  nombre: string;
  cedula: string | null;
}

export interface InformeRenderLogo {
  bytes: Uint8Array;
  format: "png" | "jpg";
}

export interface InformeRenderData {
  fecha: Date; // fecha de emisión (default: now); aparece arriba a la derecha
  /**
   * El encabezado ya parseado: una entrada por línea, con su estilo y sus
   * pedazos de texto. Lo arma `parsearEncabezado` a partir del HTML guardado, o
   * —en los informes anteriores al campo— de `titulo` más la línea de
   * actividades que se generaba sola.
   */
  encabezado: LineaEncabezado[];
  secciones: InformeRenderSeccion[];
  firmantes: InformeRenderFirmante[]; // 1 to 3
  logo?: InformeRenderLogo | null;
}

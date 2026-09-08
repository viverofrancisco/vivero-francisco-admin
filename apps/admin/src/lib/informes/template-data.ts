// Plain data the PDF renderer needs. Keep this file dependency-free so it
// can be imported from both the service (server) and any preview UI.

import type { LineaEncabezado } from "./encabezado";

/** Cuántas fotos entran en una fila. Es la palanca de densidad de la sección. */
export type FotosPorFila = 2 | 3 | 4;

export interface InformeRenderSeccion {
  titulo: string;
  descripcion: string | null;
  // Fotos resueltas a buffers de imagen ANTES de pasar al renderer.
  // (react-pdf no descarga remote URLs de manera confiable en serverless.)
  fotos: { id: string; bytes: Uint8Array; mimeType: string }[];
  /** Empieza en una hoja nueva. */
  saltoDePagina: boolean;
  fotosPorFila: FotosPorFila;
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

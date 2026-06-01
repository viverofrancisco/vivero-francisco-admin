// Plain data the PDF renderer needs. Keep this file dependency-free so it
// can be imported from both the service (server) and any preview UI.

export interface InformeRenderSeccion {
  titulo: string;
  descripcion: string | null;
  // Fotos resueltas a buffers de imagen ANTES de pasar al renderer.
  // (react-pdf no descarga remote URLs de manera confiable en serverless.)
  fotos: { id: string; bytes: Uint8Array; mimeType: string }[];
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
  titulo: string; // ej. "INFORME DE ÁREAS VERDES MES DE ENERO 2026 DE LA URBANIZACIÓN PACÍFICA"
  subtitulo: string; // ej. "ACTIVIDADES REALIZADA EN EL MANTENIMIENTO DE ÁREAS VERDES DE LA URBANIZACIÓN PACÍFICA"
  secciones: InformeRenderSeccion[];
  firmantes: InformeRenderFirmante[]; // 1 to 3
  logo?: InformeRenderLogo | null;
}

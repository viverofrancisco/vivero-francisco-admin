import { apiRequest } from "@/lib/api";

/**
 * Lo que responde una acción en lote.
 *
 * No es "salió bien" o "salió mal": el lote no es una sola operación —cada
 * ficha se revisa sola— así que la pantalla necesita saber cuántas salieron y
 * **cuáles** se quedaron, con su motivo.
 */
export interface ResultadoEnLote {
  eliminados: number;
  errores: { id: string; nombre: string | null; motivo: string }[];
}

export function eliminarEnLote(endpoint: string, ids: string[]) {
  return apiRequest<ResultadoEnLote>(endpoint, {
    method: "POST",
    body: { ids },
  });
}

/**
 * Qué contar de vuelta cuando alguna se quedó. `null` si salieron todas.
 *
 * Nombra a las que fallaron en vez de decir "algunas fallaron", que deja a
 * quien lo hizo sin saber cuál reintentar; con una sola, además, cabe el
 * motivo, que es lo que dice qué hacer.
 */
export function avisoDeLote(
  resultado: ResultadoEnLote,
  plural: string
): string | null {
  const { errores } = resultado;
  if (errores.length === 0) return null;
  if (errores.length === 1) {
    const [e] = errores;
    return `${e.nombre ? `${e.nombre}: ` : ""}${e.motivo}`;
  }
  const nombres = errores
    .slice(0, 3)
    .map((e) => e.nombre ?? "uno")
    .join(", ");
  const resto = errores.length > 3 ? ` y ${errores.length - 3} más` : "";
  return `No se pudieron eliminar ${errores.length} ${plural}: ${nombres}${resto}`;
}

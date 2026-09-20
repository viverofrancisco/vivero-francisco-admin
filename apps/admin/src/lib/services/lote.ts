/**
 * Lo que responde una acción en lote.
 *
 * No es "salió bien" o "salió mal": el lote no es una sola operación —cada
 * ficha se revisa sola— así que la pantalla necesita saber cuántas salieron y
 * **cuáles** se quedaron, con su motivo. Un "algunas fallaron" deja a quien lo
 * hizo sin saber cuál reintentar.
 */
export interface ResultadoEnLote {
  eliminados: number;
  errores: {
    id: string;
    /** Para poder nombrarla en el aviso. `null` si ya no existe. */
    nombre: string | null;
    motivo: string;
  }[];
}

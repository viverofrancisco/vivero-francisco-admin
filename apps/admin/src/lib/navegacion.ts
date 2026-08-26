/**
 * A dónde vuelve la flecha del detalle.
 *
 * El listado manda su URL completa —con filtros y página— en `?from=`, para
 * que volver devuelva la lista como estaba y no recién abierta. Lo que llega
 * es texto de la URL, así que solo se acepta una ruta interna del dashboard:
 * cualquier otra cosa sería un redirect abierto con la flecha de "volver".
 */
export function hrefDeVuelta(
  from: string | undefined,
  porDefecto: string
): string {
  return from && from.startsWith("/dashboard/") ? from : porDefecto;
}

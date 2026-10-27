/**
 * Lo que trae la página siguiente de una lista, pegado a lo que ya había y
 * sin repetir ninguno.
 *
 * El servidor ordena con un desempate único (ver `listarOrdenes`), así que de
 * a páginas no debería repetirse nada; pero entre una página y la siguiente
 * alguien puede crear o borrar una fila y correr el resto un lugar, y
 * entonces la última de una página vuelve a ser la primera de la otra. Dos
 * filas con el mismo id son además un error de React (claves duplicadas),
 * y uno que se ve dos veces.
 */
export function sumarSinRepetir<T extends { id: string }>(antes: T[], nuevos: T[]): T[] {
  const ya = new Set(antes.map((a) => a.id));
  return [...antes, ...nuevos.filter((n) => !ya.has(n.id))];
}

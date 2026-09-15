/**
 * Cómo se escriben las marcas de entrada y salida.
 *
 * Compartido entre la tarjeta del jardinero y la vista de la oficina, para que
 * las dos digan la misma hora del mismo instante. Sin `"use client"`: lo usan
 * componentes de cliente y de servidor.
 */

/** La zona en que trabaja el vivero. Ecuador no tiene horario de verano. */
const ZONA = "America/Guayaquil";

/** `"08:15"`. El instante, en la hora del vivero. */
export function horaLocal(fecha: Date | string): string {
  return new Date(fecha).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA,
  });
}

/**
 * `"08:15"`, o `"08:15 (5 sep)"` si la marca no es del día de la visita.
 *
 * Pasa de verdad: alguien que cruza la medianoche, y alguien que se olvidó de
 * marcar y lo hace al otro día. Sin el día al lado, "00:30" parece un error de
 * tipeo en vez de la salida de un turno que empezó ayer.
 */
export function horaConDia(fecha: Date | string, diaDeLaVisita: Date | string): string {
  const d = new Date(fecha);
  const soloDia = (x: Date) =>
    x.toLocaleDateString("es-EC", { timeZone: ZONA, day: "2-digit", month: "short" });
  const mismo = soloDia(d) === soloDia(new Date(diaDeLaVisita));
  return mismo ? horaLocal(d) : `${horaLocal(d)} (${soloDia(d)})`;
}

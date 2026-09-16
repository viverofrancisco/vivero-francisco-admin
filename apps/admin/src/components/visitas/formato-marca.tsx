/**
 * Cómo se escriben las marcas de entrada y salida.
 *
 * Compartido entre la tarjeta del jardinero y la vista de la oficina, para que
 * las dos digan la misma hora del mismo instante. Sin `"use client"`: lo usan
 * componentes de cliente y de servidor.
 */

/** La zona en que trabaja el vivero. Ecuador no tiene horario de verano. */
const ZONA = "America/Guayaquil";

/**
 * `"8:15 AM"`. El instante, en la hora del vivero y como se dice acá.
 *
 * El servidor las guarda en 24 horas —`Visita.horaEntrada` es texto `"HH:MM"`,
 * que así ordena solo y no es ambiguo— y convertir es cosa de la pantalla.
 * Nadie en Ecuador dice "las 17:26".
 */
export function horaLocal(fecha: Date | string): string {
  return doceHoras(
    new Date(fecha).toLocaleTimeString("es-EC", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: ZONA,
    })
  );
}

/** De `"17:26"` a `"5:26 PM"`. Devuelve lo que entró si no lo entiende. */
export function hora12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return doceHoras(
    d.toLocaleTimeString("es-EC", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

/**
 * `es-EC` escribe "p. m.": minúsculas, con puntos y con un espacio angosto en
 * el medio. Queda "PM", que es más corto y se lee de un vistazo. El regex
 * acepta las dos formas porque el separador cambia entre versiones de ICU, y
 * una regla atada a una de ellas se rompe sola.
 */
function doceHoras(texto: string): string {
  return texto
    .replace(/[\s\u202f\u00a0]*a\.?[\s\u202f\u00a0]*m\.?$/i, " AM")
    .replace(/[\s\u202f\u00a0]*p\.?[\s\u202f\u00a0]*m\.?$/i, " PM");
}

/**
 * `"8:15 AM"`, o `"8:15 AM (5 sep)"` si la marca no es del día de la visita.
 *
 * Pasa de verdad: alguien que cruza la medianoche, y alguien que se olvidó de
 * marcar y lo hace al otro día. Sin el día al lado, "12:30 AM" parece un error
 * de tipeo en vez de la salida de un turno que empezó ayer.
 */
export function horaConDia(fecha: Date | string, diaDeLaVisita: Date | string): string {
  const d = new Date(fecha);
  const soloDia = (x: Date) =>
    x.toLocaleDateString("es-EC", { timeZone: ZONA, day: "2-digit", month: "short" });
  const mismo = soloDia(d) === soloDia(new Date(diaDeLaVisita));
  return mismo ? horaLocal(d) : `${horaLocal(d)} (${soloDia(d)})`;
}

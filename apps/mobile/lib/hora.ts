/**
 * Las horas, como se dicen en Ecuador: "5:19 p. m.", no "17:19".
 *
 * El servidor las guarda y las manda en 24 horas —`horaDe()` formatea así, y
 * `Visita.horaEntrada` es texto `"HH:MM"`— porque en ese formato ordenan solas
 * y no hay ambigüedad. Convertir es cosa de la pantalla, no del dato.
 */
const ZONA = "America/Guayaquil";

/** De `"17:19"` a `"5:19 p. m."`. Devuelve lo que entró si no lo entiende. */
export function hora12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return formatear(d);
}

/** De un instante a `"5:19 p. m."`, en la hora del vivero. */
export function hora12De(fecha: Date): string {
  return formatear(fecha);
}

function formatear(d: Date): string {
  return d
    .toLocaleTimeString("es-EC", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: ZONA,
    })
    // El locale mete un espacio angosto que en algunas fuentes se ve como un
    // salto; uno normal se ve igual y no rompe la línea de forma rara.
    .replace(/ | /g, " ");
}

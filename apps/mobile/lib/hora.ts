/**
 * Las horas, como se dicen en Ecuador: "5:19 PM", no "17:19".
 *
 * El servidor las guarda y las manda en 24 horas —`horaDe()` formatea así, y
 * `Visita.horaEntrada` es texto `"HH:MM"`— porque en ese formato ordenan solas
 * y no hay ambigüedad. Convertir es cosa de la pantalla, no del dato.
 */
const ZONA = "America/Guayaquil";

/** De `"17:19"` a `"5:19 PM"`. Devuelve lo que entró si no lo entiende. */
export function hora12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return formatear(d);
}

/** De un instante a `"5:19 PM"`, en la hora del vivero. */
export function hora12De(fecha: Date): string {
  return formatear(fecha);
}

function formatear(d: Date): string {
  return (
    d
      .toLocaleTimeString("es-EC", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: ZONA,
      })
      // `es-EC` escribe "p. m.": minúsculas, con puntos, y con un espacio
      // angosto en el medio que en algunas fuentes se ve como un salto de
      // línea. Queda "PM", que es más corto y se lee de un vistazo en una fila.
      // El regex acepta las dos formas porque el separador cambia entre
      // versiones de ICU, y una regla atada a una de ellas se rompe sola.
      .replace(/[\s\u202f\u00a0]*a\.?[\s\u202f\u00a0]*m\.?$/i, " AM")
      .replace(/[\s\u202f\u00a0]*p\.?[\s\u202f\u00a0]*m\.?$/i, " PM")
  );
}

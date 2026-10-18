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

/**
 * Un instante completo: `"14 sep, 5:19 PM"`.
 *
 * La fecha va **con** la hora en todo lo que es una marca. Una fila que dice
 * solo "5:26 PM" no distingue haber marcado el día de la visita de haberlo
 * hecho tres días después: se lee igual, y esa diferencia es justo la que la
 * oficina necesita ver.
 */
export function fechaYHora12(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d
    .toLocaleDateString("es-EC", {
      day: "numeric",
      month: "short",
      timeZone: ZONA,
    })
    // `es-EC` deja "14 sept" y a veces con punto. Tres letras alcanzan.
    .replace(/\.$/, "");
  return `${dia}, ${formatear(d)}`;
}

/**
 * El día de hoy en Ecuador, `YYYY-MM-DD`.
 *
 * En la zona del vivero y no en la del teléfono: el servidor decide con la de
 * Ecuador (`hoyISOEcuador`), y si la pantalla usara otra habría botones que se
 * ofrecen y el servidor rechaza.
 */
export function hoyEnEcuador(): string {
  return diaEnEcuador(new Date());
}

/**
 * El día en que cae un **instante**, en Ecuador.
 *
 * No es lo mismo que recortar su ISO, y confundirlos es fácil: una salida
 * marcada a las 20:00 de Guayaquil es la 01:00 UTC del día siguiente. Recortar
 * sirve para `@db.Date` —que viaja como medianoche UTC—, no para una marca.
 */
export function diaEnEcuador(instante: string | Date): string {
  // `en-CA` da exactamente `YYYY-MM-DD`.
  return new Date(instante).toLocaleDateString("en-CA", { timeZone: ZONA });
}

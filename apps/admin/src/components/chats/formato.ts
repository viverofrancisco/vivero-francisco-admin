/**
 * La hora de un mensaje, como la dice WhatsApp: la hora si es de hoy, "Ayer",
 * el día de la semana si es de esta semana, y la fecha si es más viejo.
 *
 * Es un **instante**, no un día del calendario, así que va en la zona de
 * Ecuador y no en UTC: lo que se muestra es la hora a la que alguien escribió.
 */
const ZONA = "America/Guayaquil";

function enLaZona(iso: string | Date): Date {
  return typeof iso === "string" ? new Date(iso) : iso;
}

function diaDe(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA });
}

export function horaDeMensaje(iso: string | Date): string {
  return enLaZona(iso).toLocaleTimeString("es-EC", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fechaRelativaCorta(iso: string | Date): string {
  const fecha = enLaZona(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

  if (diaDe(fecha) === diaDe(hoy)) return horaDeMensaje(fecha);
  if (diaDe(fecha) === diaDe(ayer)) return "Ayer";

  const haceUnaSemana = new Date(hoy.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (fecha >= haceUnaSemana) {
    return fecha.toLocaleDateString("es-EC", { timeZone: ZONA, weekday: "long" });
  }
  return fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
  });
}

/** El separador de día que va entre los mensajes. */
export function tituloDelDia(iso: string | Date): string {
  const fecha = enLaZona(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  if (diaDe(fecha) === diaDe(hoy)) return "Hoy";
  if (diaDe(fecha) === diaDe(ayer)) return "Ayer";
  return fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Si dos mensajes son del mismo día, para no repetir el separador. */
export function mismoDia(a: string | Date, b: string | Date): boolean {
  return diaDe(enLaZona(a)) === diaDe(enLaZona(b));
}

/**
 * Cuándo alguien leyó un mensaje, para la info del mensaje: "Hoy, 9:24 p. m.",
 * "Ayer, 9:24 p. m." o "22 sept, 9:24 p. m.".
 */
export function cuandoLeyo(iso: string | Date): string {
  const fecha = enLaZona(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  const hora = horaDeMensaje(fecha);
  if (diaDe(fecha) === diaDe(hoy)) return `Hoy, ${hora}`;
  if (diaDe(fecha) === diaDe(ayer)) return `Ayer, ${hora}`;
  const dia = fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
  });
  return `${dia}, ${hora}`;
}

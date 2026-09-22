/**
 * Lo que la app necesita saber de un chat, y cómo se dice la hora.
 *
 * Los tipos son los que devuelve `chat.service` del portal; las dos
 * aplicaciones muestran lo mismo, así que si esto se desacomoda es que alguien
 * cambió el servicio sin mirar acá.
 */

export interface ChatEnLista {
  id: string;
  nombre: string;
  miembros: number;
  sinLeer: number;
  ultimo: {
    texto: string | null;
    autorNombre: string;
    createdAt: string;
    fotos: number;
  } | null;
}

export interface MiembroDeChat {
  id: string;
  nombre: string;
  rol: string;
  soyYo: boolean;
}

export interface ChatDetalle {
  id: string;
  nombre: string;
  creadoEl: string;
  puedeEditar: boolean;
  miembros: MiembroDeChat[];
}

export interface MensajeDeChat {
  id: string;
  texto: string | null;
  fotos: { id: string; url: string; tipo: string }[];
  createdAt: string;
  borrado: boolean;
  autorId: string | null;
  autorNombre: string;
  mio: boolean;
  respondeA: {
    id: string;
    autorNombre: string;
    texto: string | null;
    borrado: boolean;
    fotos: number;
  } | null;
}

/** Lo que muestra el renglón de la lista cuando el último mensaje es una foto. */
export function resumenDelUltimo(ultimo: ChatEnLista["ultimo"]): string {
  if (!ultimo) return "Sin mensajes";
  const cuerpo =
    ultimo.texto ??
    (ultimo.fotos === 1 ? "📷 Foto" : `📷 ${ultimo.fotos} fotos`);
  return `${ultimo.autorNombre}: ${cuerpo}`;
}

const ZONA = "America/Guayaquil";

function dia(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA });
}

/**
 * La hora de un mensaje. Es un **instante**, no un día del calendario, así que
 * va en la zona de Ecuador: lo que se muestra es la hora a la que alguien
 * escribió.
 */
export function horaDeMensaje(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-EC", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Lo que va al costado del chat en la lista: la hora, "Ayer", el día, la fecha. */
export function cuandoFue(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  if (dia(fecha) === dia(hoy)) return horaDeMensaje(iso);
  const ayer = new Date(hoy.getTime() - 86400000);
  if (dia(fecha) === dia(ayer)) return "Ayer";
  const semana = new Date(hoy.getTime() - 6 * 86400000);
  if (fecha >= semana) {
    return fecha.toLocaleDateString("es-EC", { timeZone: ZONA, weekday: "long" });
  }
  return fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
  });
}

/** El separador que va entre los mensajes de días distintos. */
export function tituloDelDia(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  if (dia(fecha) === dia(hoy)) return "Hoy";
  const ayer = new Date(hoy.getTime() - 86400000);
  if (dia(fecha) === dia(ayer)) return "Ayer";
  return fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function mismoDia(a: string, b: string): boolean {
  return dia(new Date(a)) === dia(new Date(b));
}

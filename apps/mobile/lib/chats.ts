import { etiquetaDeAdjuntos } from "@vivero/shared";
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
  /** La foto del grupo, si el admin le puso una. */
  imagenUrl?: string | null;
  miembros: number;
  sinLeer: number;
  ultimo: {
    texto: string | null;
    autorNombre: string;
    createdAt: string;
    fotos: number;
    /** El tipo del primer adjunto: foto, video o documento. */
    tipo?: string | null;
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
  imagenUrl?: string | null;
  /** Cuántas fotos y videos, documentos y enlaces hay, para la info. */
  medios?: { fotosYVideos: number; documentos?: number; enlaces: number };
  creadoEl: string;
  puedeEditar: boolean;
  miembros: MiembroDeChat[];
}

/** Un mensaje encontrado por el buscador, con de qué chat es. */
export interface MensajeEncontrado {
  id: string;
  chatId: string;
  chatNombre: string;
  chatImagenUrl?: string | null;
  autorNombre: string;
  mio: boolean;
  texto: string | null;
  createdAt: string;
  foto: { id: string; url: string; nombre: string | null; tipo: string } | null;
  fotos: number;
}

/**
 * Un mensaje, y la info de quién lo leyó: los tipos son los de `@vivero/shared`,
 * porque las dos aplicaciones dibujan lo mismo y el portal manda lo mismo.
 */
export type {
  MensajeDeChat,
  InfoDeMensaje,
  EstadoDeMensaje,
  ArchivoDelChat,
  EnlaceDelChat,
} from "@vivero/shared";

/** Cómo se nombra un adjunto cuando no hay texto que lo acompañe. El mismo que el portal. */
export { etiquetaDeAdjuntos };

/** Lo que muestra el renglón de la lista cuando el último mensaje es un adjunto. */
export function resumenDelUltimo(ultimo: ChatEnLista["ultimo"]): string {
  if (!ultimo) return "Sin mensajes";
  const cuerpo =
    ultimo.texto ?? etiquetaDeAdjuntos(ultimo.tipo ?? undefined, ultimo.fotos);
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

/**
 * Cuándo alguien leyó un mensaje, para la info del mensaje: "Hoy, 9:24 p. m.",
 * "Ayer, 9:24 p. m." o "22 sept, 9:24 p. m.".
 */
export function cuandoLeyo(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86400000);
  const hora = horaDeMensaje(iso);
  if (dia(fecha) === dia(hoy)) return `Hoy, ${hora}`;
  if (dia(fecha) === dia(ayer)) return `Ayer, ${hora}`;
  const cuando = fecha.toLocaleDateString("es-EC", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
  });
  return `${cuando}, ${hora}`;
}

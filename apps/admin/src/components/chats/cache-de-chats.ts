"use client";

import type { ChatCabecera, MensajeEnPantalla } from "./conversacion";

/**
 * Una copia local de cada chat para abrirlo **al instante**.
 *
 * No es la verdad, es un snapshot: los últimos treinta mensajes, el
 * encabezado y el cursor para seguir hacia atrás, guardados cada vez que la
 * conversación cambia. Lo usa `[id]/loading.tsx`: mientras Next trae la
 * página, dibuja la conversación guardada en vez de un esqueleto, así cambiar
 * de chat en el escritorio no parpadea. Lo que llega del servidor la
 * reemplaza entera, y por eso los vistos y "quién leyó" no se desincronizan:
 * vienen del servidor en cada sondeo.
 *
 * Es la misma idea que en la app (`lib/cache-de-chats.ts`), con la diferencia
 * de que aquí la lista de chats no hace falta: viene con el HTML.
 */

export const MENSAJES_EN_CACHE = 30;
const claveDe = (chatId: string) => `chats:cache:${chatId}`;

export interface ChatEnCache {
  chat: ChatCabecera;
  /** Del más nuevo al más viejo, como los manda el servidor y los recibe `Conversacion`. */
  mensajes: MensajeEnPantalla[];
  cursor: string | null;
  guardadoEl: string;
}

/**
 * Lo leído por chat, memorizado por el texto crudo: `useSyncExternalStore`
 * exige que el snapshot sea **el mismo objeto** mientras nada cambió, y
 * parsear el JSON en cada render devolvería uno nuevo cada vez.
 */
const memoria = new Map<string, { crudo: string; valor: ChatEnCache | null }>();

export function leerChat(chatId: string): ChatEnCache | null {
  if (typeof window === "undefined") return null;
  let crudo: string | null;
  try {
    crudo = window.localStorage.getItem(claveDe(chatId));
  } catch {
    return null;
  }
  if (!crudo) return null;
  const previo = memoria.get(chatId);
  if (previo && previo.crudo === crudo) return previo.valor;
  let valor: ChatEnCache | null = null;
  try {
    const parseado = JSON.parse(crudo) as ChatEnCache;
    valor =
      parseado && Array.isArray(parseado.mensajes) && parseado.chat
        ? parseado
        : null;
  } catch {
    valor = null;
  }
  memoria.set(chatId, { crudo, valor });
  return valor;
}

/** Para `useSyncExternalStore`: el snapshot se lee al renderizar, no hay nada que escuchar. */
export function suscribir() {
  return () => {};
}

/**
 * Guardar la tanda más nueva. `mensajes` viene como los tiene la pantalla,
 * del más viejo al más nuevo; se guarda al revés, que es como los entrega el
 * servidor y como `Conversacion` los espera. Si había más cargados —se hizo
 * scroll hacia arriba— se recorta, y el cursor pasa a ser el del más viejo
 * que quedó: es lo que el servidor daría para esa misma página.
 */
export function guardarChat(
  chatId: string,
  chat: ChatCabecera,
  mensajes: MensajeEnPantalla[],
  cursor: string | null
) {
  if (typeof window === "undefined") return;
  const tanda = [...mensajes].reverse().slice(0, MENSAJES_EN_CACHE);
  const cursorTanda =
    mensajes.length > MENSAJES_EN_CACHE
      ? (tanda[tanda.length - 1]?.id ?? cursor)
      : cursor;
  const cache: ChatEnCache = {
    chat,
    mensajes: tanda,
    cursor: cursorTanda,
    guardadoEl: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(claveDe(chatId), JSON.stringify(cache));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena) no hay copia, y no pasa nada.
  }
}

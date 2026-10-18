import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ArchivoDelChat,
  ChatDetalle,
  ChatEnLista,
  EnlaceDelChat,
  MensajeDeChat,
} from "./chats";

/**
 * Una copia local de cada chat para abrirlo **al instante**.
 *
 * No es la verdad, es un snapshot: los últimos treinta mensajes, el
 * encabezado y el cursor para seguir hacia atrás, guardados cada vez que el
 * servidor contesta. Al abrir el chat se pinta eso mientras se pregunta, y lo
 * que llega lo reemplaza entero. Por eso los vistos y "quién leyó" no se
 * desincronizan: vienen del servidor en cada sondeo, y la copia solo existe
 * para no mirar un spinner mientras tanto.
 *
 * WhatsApp guarda **todo** en el teléfono porque, con cifrado de punta a punta,
 * el servidor no puede guardar el historial. Aquí sí puede, y una copia
 * completa sería una segunda base de datos que mantener honesta. Lo viejo se
 * sigue pidiendo al servidor al hacer scroll hacia arriba.
 */

export const MENSAJES_EN_CACHE = 30;
const CLAVE_LISTA = "chats:cache:lista";
const claveDe = (chatId: string) => `chats:cache:${chatId}`;

export interface ChatEnCache {
  chat: ChatDetalle;
  /** Del más nuevo al más viejo, como los manda el servidor. */
  items: MensajeDeChat[];
  cursor: string | null;
  guardadoEl: string;
}

export async function leerLista(): Promise<ChatEnLista[] | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_LISTA);
    const lista = crudo ? (JSON.parse(crudo) as ChatEnLista[]) : null;
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

export function guardarLista(items: ChatEnLista[]) {
  AsyncStorage.setItem(CLAVE_LISTA, JSON.stringify(items)).catch(() => {});
}

export async function leerChat(chatId: string): Promise<ChatEnCache | null> {
  try {
    const crudo = await AsyncStorage.getItem(claveDe(chatId));
    const cache = crudo ? (JSON.parse(crudo) as ChatEnCache) : null;
    return cache && Array.isArray(cache.items) && cache.chat ? cache : null;
  } catch {
    return null;
  }
}

/**
 * Guardar la tanda más nueva. Si había más cargados —se hizo scroll hacia
 * arriba— se recorta, y el cursor pasa a ser el del último que quedó: es lo
 * que el servidor daría para esa misma página.
 */
export function guardarChat(
  chatId: string,
  chat: ChatDetalle,
  items: MensajeDeChat[],
  cursor: string | null
) {
  const tanda = items.slice(0, MENSAJES_EN_CACHE);
  const cursorTanda =
    items.length > MENSAJES_EN_CACHE ? (tanda[tanda.length - 1]?.id ?? cursor) : cursor;
  const cache: ChatEnCache = {
    chat,
    items: tanda,
    cursor: cursorTanda,
    guardadoEl: new Date().toISOString(),
  };
  AsyncStorage.setItem(claveDe(chatId), JSON.stringify(cache)).catch(() => {});
}

/**
 * La primera página de fotos y videos, enlaces o documentos de un chat: se
 * pinta al abrir la vista y el servidor la reemplaza detrás, igual que la
 * conversación. Sin esto abrir "Fotos y videos" era mirar un hueco mientras
 * llegaba lo mismo que se vio ayer.
 */
export type TipoDeMedios = "archivos" | "enlaces" | "documentos";

export interface MediosEnCache {
  tipo: TipoDeMedios;
  items: (ArchivoDelChat | EnlaceDelChat)[];
  cursor: string | null;
}

const claveMedios = (chatId: string, tipo: TipoDeMedios) => `chats:medios:${chatId}:${tipo}`;

export async function leerMedios(chatId: string, tipo: TipoDeMedios): Promise<MediosEnCache | null> {
  try {
    const crudo = await AsyncStorage.getItem(claveMedios(chatId, tipo));
    const cache = crudo ? (JSON.parse(crudo) as MediosEnCache) : null;
    return cache && Array.isArray(cache.items) ? cache : null;
  } catch {
    return null;
  }
}

export function guardarMedios(chatId: string, datos: MediosEnCache) {
  AsyncStorage.setItem(
    claveMedios(chatId, datos.tipo),
    JSON.stringify({ ...datos, items: datos.items.slice(0, 60) })
  ).catch(() => {});
}

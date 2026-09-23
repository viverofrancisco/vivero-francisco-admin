"use client";

import { useSyncExternalStore } from "react";
import type { MensajeDeChat, MensajeEnCola } from "@vivero/shared";

/**
 * La cola de salida de los chats: lo que se escribió y todavía no llegó.
 *
 * Un mensaje aparece en la conversación **en el acto** y se manda después,
 * como en WhatsApp: esperar la respuesta del servidor para dibujarlo hacía
 * que escribir se sintiera como llenar un formulario. Y sin señal no se pierde:
 * se queda esperando con un solo ✓ y sale solo cuando vuelve la conexión.
 *
 * Vive **fuera de React**, a nivel de módulo, por dos motivos: sigue mandando
 * aunque la persona cambie de chat —el componente se desmonta, la cola no— y
 * es una sola para toda la pestaña, así dos conversaciones abiertas no se
 * pisan. Las pantallas se enteran por `useCola` y por `onEnviado`.
 *
 * **Qué sobrevive a recargar la página**: los mensajes de texto, que van a
 * `localStorage`. Los que llevan fotos no: el archivo es un `File` que solo
 * existe en la memoria de esta pestaña, y la miniatura es una URL de objeto
 * que muere con ella. Esos siguen intentando mientras la pestaña esté abierta
 * y, si se cierra antes de que salgan, se pierden — es lo mismo que le pasa a
 * WhatsApp Web sin el teléfono.
 *
 * **Qué es un fallo y qué es esperar**: no llegar al servidor —`fetch` que
 * revienta, `navigator.onLine` en falso, un 5xx— es esperar, y se reintenta
 * solo. Un 4xx es que el servidor lo miró y dijo que no; ese queda `fallido`
 * con su motivo y espera a que alguien lo reintente o lo descarte.
 */

const CLAVE = "chats:cola-de-envio";
/** Cada cuánto vuelve a intentar mientras haya algo esperando. */
const REINTENTO_MS = 5000;

let items: MensajeEnCola[] = cargar();
/** Los archivos de las fotos, por `idCliente`. Solo en memoria. */
const archivos = new Map<string, File[]>();
const oyentes = new Set<() => void>();
const alEnviar = new Set<(chatId: string, mensaje: MensajeDeChat) => void>();
let procesando = false;
let reloj: ReturnType<typeof setInterval> | null = null;

function cargar(): MensajeEnCola[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const lista = crudo ? (JSON.parse(crudo) as MensajeEnCola[]) : [];
    // Lo que falló antes de recargar sigue fallido: nadie lo reintentó.
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function guardar() {
  if (typeof window === "undefined") return;
  try {
    // Solo lo que se puede volver a mandar sin esta pestaña: el texto.
    const persistibles = items.filter((i) => i.fotos.length === 0);
    if (persistibles.length === 0) window.localStorage.removeItem(CLAVE);
    else window.localStorage.setItem(CLAVE, JSON.stringify(persistibles));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena) la cola vive en memoria.
  }
}

function cambiar(nuevos: MensajeEnCola[]) {
  items = nuevos;
  guardar();
  oyentes.forEach((f) => f());
  programar();
}

/** Mientras haya algo esperando, un intento cada tanto. Sin nada, nada. */
function programar() {
  const hayPendientes = items.some((i) => i.estado === "pendiente");
  if (hayPendientes && !reloj) {
    reloj = setInterval(() => procesar(), REINTENTO_MS);
  } else if (!hayPendientes && reloj) {
    clearInterval(reloj);
    reloj = null;
  }
}

function soltarArchivos(idCliente: string) {
  archivos.delete(idCliente);
  const item = items.find((i) => i.idCliente === idCliente);
  item?.fotos.forEach((f) => {
    if (f.uri.startsWith("blob:")) URL.revokeObjectURL(f.uri);
  });
}

/** Los mensajes que esperan, para dibujarlos. Se re-renderiza al cambiar la cola. */
export function useCola(): MensajeEnCola[] {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => items,
    () => items
  );
}

/** Avisar cuando un mensaje de la cola volvió del servidor, para pegarlo a la lista. */
export function onEnviado(f: (chatId: string, mensaje: MensajeDeChat) => void) {
  alEnviar.add(f);
  return () => {
    alEnviar.delete(f);
  };
}

/** Poner un mensaje a la cola. Sale en cuanto se pueda. */
export function encolar(item: MensajeEnCola, files: File[] = []) {
  if (files.length > 0) archivos.set(item.idCliente, files);
  cambiar([...items, item]);
  void procesar();
}

/** Volver a intentar uno que falló. */
export function reintentar(idCliente: string) {
  cambiar(
    items.map((i) =>
      i.idCliente === idCliente
        ? { ...i, estado: "pendiente", error: undefined }
        : i
    )
  );
  void procesar();
}

/** Sacarlo de la cola sin mandarlo. */
export function descartar(idCliente: string) {
  soltarArchivos(idCliente);
  cambiar(items.filter((i) => i.idCliente !== idCliente));
}

/**
 * El servidor ya lo tiene: llegó por otro camino —el sondeo lo trajo antes
 * que la respuesta del envío, o el envío se cortó después de guardarse—.
 */
export function confirmarLlegada(idCliente: string) {
  if (!items.some((i) => i.idCliente === idCliente)) return;
  soltarArchivos(idCliente);
  cambiar(items.filter((i) => i.idCliente !== idCliente));
}

/** Los que esperan en un chat. */
export function pendientesDe(chatId: string) {
  return items.filter((i) => i.chatId === chatId);
}

async function subir(
  chatId: string,
  item: MensajeEnCola,
  files: File[]
): Promise<{ key: string; url: string; nombre: string; tipo: "imagen" | "video" | "documento"; tamano: number | null }[]> {
  const res = await fetch(`/api/chats/${chatId}/fotos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f, i) => ({
        fileName: item.fotos[i]?.nombre ?? f.name,
        contentType: item.fotos[i]?.contentType ?? f.type,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new RespuestaDelServidor(res.status, data.error ?? "No pudimos preparar la subida");
  }
  await Promise.all(
    data.uploads.map((u: { uploadUrl: string; contentType: string }, i: number) =>
      fetch(u.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": u.contentType },
        body: files[i],
      }).then((r) => {
        if (!r.ok) throw new RespuestaDelServidor(r.status, "No pudimos subir una de las fotos");
      })
    )
  );
  return data.uploads.map(
    (u: { key: string; url: string; tipo: "imagen" | "video" | "documento" }, i: number) => ({
      key: u.key,
      url: u.url,
      nombre: item.fotos[i]?.nombre ?? files[i].name,
      tipo: u.tipo,
      tamano: item.fotos[i]?.tamano ?? files[i].size ?? null,
    })
  );
}

/** El servidor contestó y dijo que no. Distinto de no haber llegado. */
class RespuestaDelServidor extends Error {
  constructor(
    public status: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

/**
 * Mandar lo que espera, en orden y de a uno: dos mensajes seguidos tienen
 * que llegar en el orden en que se escribieron.
 */
export async function procesar() {
  if (procesando) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  procesando = true;
  try {
    for (;;) {
      const item = items.find((i) => i.estado === "pendiente");
      if (!item) break;
      try {
        let fotos: Awaited<ReturnType<typeof subir>> = [];
        if (item.fotos.length > 0) {
          const files = archivos.get(item.idCliente);
          if (!files) {
            // Recargaron la página con esto esperando: el archivo se fue.
            throw new RespuestaDelServidor(
              0,
              "Las fotos se perdieron al recargar la página. Vuelve a elegirlas."
            );
          }
          fotos = await subir(item.chatId, item, files);
        }
        const res = await fetch(`/api/chats/${item.chatId}/mensajes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: item.texto,
            fotos,
            respondeAId: item.respondeA?.id ?? null,
            idCliente: item.idCliente,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new RespuestaDelServidor(res.status, data.error ?? "No pudimos enviar");
        }
        soltarArchivos(item.idCliente);
        cambiar(items.filter((i) => i.idCliente !== item.idCliente));
        alEnviar.forEach((f) => f(item.chatId, data as MensajeDeChat));
      } catch (error) {
        const respondio = error instanceof RespuestaDelServidor;
        // Un 5xx es el servidor con un mal momento, no un no: se vuelve a
        // intentar más tarde, como si no hubiera llegado.
        const transitorio = !respondio || error.status >= 500;
        if (transitorio) {
          // Sin camino al servidor, los demás tampoco van a salir ahora.
          break;
        }
        cambiar(
          items.map((i) =>
            i.idCliente === item.idCliente
              ? { ...i, estado: "fallido", error: error.message }
              : i
          )
        );
      }
    }
  } finally {
    procesando = false;
  }
}

if (typeof window !== "undefined") {
  // Volvió la señal: lo que esperaba sale ahora, no en el próximo tic.
  window.addEventListener("online", () => void procesar());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void procesar();
  });
  programar();
  void procesar();
}

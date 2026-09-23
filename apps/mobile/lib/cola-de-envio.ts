import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import type { MensajeDeChat, MensajeEnCola } from "@vivero/shared";
import { API_BASE_URL } from "./config";
import { apiRequest } from "./api";
import { useConexion } from "./conexion";

/**
 * La cola de salida de los chats: lo que se escribió y todavía no llegó.
 *
 * Un mensaje aparece en la conversación **en el acto** y se manda después,
 * como en WhatsApp: esperar la respuesta del servidor para dibujarlo hacía que
 * escribir se sintiera como llenar un formulario. Y sin señal no se pierde: se
 * queda esperando con un solo ✓ y sale solo cuando vuelve la conexión —o
 * cuando la app vuelve al frente, o al próximo sondeo del chat abierto—.
 *
 * Es un almacén de Zustand y no estado de la pantalla porque sigue mandando
 * aunque la persona salga del chat, y porque las dos pantallas —la lista y la
 * conversación— miran la misma cola. Se guarda entera en `AsyncStorage`: las
 * fotos son archivos del teléfono, así que cerrar la app con algo esperando no
 * pierde nada, ni siquiera las fotos. Es la misma cola que el portal, con la
 * diferencia de que ahí las fotos no sobreviven a recargar la página.
 *
 * **Qué es un fallo y qué es esperar**: no llegar al servidor —`status` 0 en
 * `ApiError`, o un 5xx— es esperar, y se reintenta solo. Un 4xx es que el
 * servidor lo miró y dijo que no; ese queda `fallido` con su motivo y espera a
 * que alguien lo reintente o lo descarte.
 */

const CLAVE = "chats:cola-de-envio";
/** Cada cuánto vuelve a intentar mientras haya algo esperando. */
const REINTENTO_MS = 5000;

interface ColaState {
  items: MensajeEnCola[];
  hidratada: boolean;
  /** Levantar lo guardado. Idempotente: lo llaman las pantallas al montarse. */
  hidratar: () => Promise<void>;
  encolar: (item: MensajeEnCola) => void;
  reintentar: (idCliente: string) => void;
  descartar: (idCliente: string) => void;
  /** El servidor ya lo tiene: llegó por el sondeo antes que la respuesta del envío. */
  confirmarLlegada: (idCliente: string) => void;
  procesar: () => Promise<void>;
}

const alEnviar = new Set<(chatId: string, mensaje: MensajeDeChat) => void>();
let procesando = false;
let reloj: ReturnType<typeof setInterval> | null = null;
let hidratando: Promise<void> | null = null;

/** Avisar cuando un mensaje de la cola volvió del servidor, para pegarlo a la lista. */
export function onEnviado(f: (chatId: string, mensaje: MensajeDeChat) => void) {
  alEnviar.add(f);
  return () => {
    alEnviar.delete(f);
  };
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

function esDeRed(e: unknown): boolean {
  const status = (e as { status?: unknown })?.status;
  // `ApiError` con `status` 0 es "no llegamos"; un 5xx es el servidor con un
  // mal momento. Los dos se reintentan solos.
  return typeof status === "number" && (status === 0 || status >= 500);
}

async function subir(
  item: MensajeEnCola
): Promise<{ key: string; url: string; nombre?: string; tipo: "imagen" | "video" }[]> {
  const presign = await apiRequest<{
    uploads: {
      key: string;
      url: string;
      uploadUrl: string;
      contentType: string;
      tipo: "imagen" | "video";
    }[];
  }>(`/api/mobile/chats/${item.chatId}/fotos`, {
    method: "POST",
    body: {
      files: item.fotos.map((f) => ({
        fileName: f.nombre,
        contentType: f.contentType,
      })),
    },
  });
  await Promise.all(
    presign.uploads.map(async (u, i) => {
      let blob: Blob;
      try {
        blob = await (await fetch(item.fotos[i].uri)).blob();
      } catch {
        // El archivo ya no está: el sistema limpió la caché de la galería.
        throw new RespuestaDelServidor(
          0,
          "La foto ya no está en el teléfono. Vuelve a elegirla."
        );
      }
      const res = await fetch(u.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": u.contentType },
        body: blob,
      });
      if (!res.ok) {
        throw new RespuestaDelServidor(res.status, "No pudimos subir una de las fotos.");
      }
    })
  );
  return presign.uploads.map((u, i) => ({
    key: u.key,
    url: u.url,
    nombre: item.fotos[i].nombre,
    tipo: u.tipo,
  }));
}

export const useColaDeEnvio = create<ColaState>((set, get) => {
  function cambiar(items: MensajeEnCola[]) {
    set({ items });
    AsyncStorage.setItem(CLAVE, JSON.stringify(items)).catch(() => {});
    programar();
  }

  /** Mientras haya algo esperando, un intento cada tanto. Sin nada, nada. */
  function programar() {
    const hayPendientes = get().items.some((i) => i.estado === "pendiente");
    if (hayPendientes && !reloj) {
      reloj = setInterval(() => void get().procesar(), REINTENTO_MS);
    } else if (!hayPendientes && reloj) {
      clearInterval(reloj);
      reloj = null;
    }
  }

  return {
    items: [],
    hidratada: false,

    hidratar: () => {
      if (get().hidratada) return Promise.resolve();
      if (hidratando) return hidratando;
      hidratando = (async () => {
        try {
          const crudo = await AsyncStorage.getItem(CLAVE);
          const guardados = crudo ? (JSON.parse(crudo) as MensajeEnCola[]) : [];
          // Lo que se encoló mientras se leía el disco va después de lo que
          // ya estaba: el orden de escritura es el orden de salida.
          set({
            items: [...(Array.isArray(guardados) ? guardados : []), ...get().items],
            hidratada: true,
          });
        } catch {
          set({ hidratada: true });
        } finally {
          hidratando = null;
        }
        programar();
        void get().procesar();
      })();
      return hidratando;
    },

    encolar: (item) => {
      cambiar([...get().items, item]);
      void get().procesar();
    },

    reintentar: (idCliente) => {
      cambiar(
        get().items.map((i) =>
          i.idCliente === idCliente
            ? { ...i, estado: "pendiente", error: undefined }
            : i
        )
      );
      void get().procesar();
    },

    descartar: (idCliente) => {
      cambiar(get().items.filter((i) => i.idCliente !== idCliente));
    },

    confirmarLlegada: (idCliente) => {
      if (!get().items.some((i) => i.idCliente === idCliente)) return;
      cambiar(get().items.filter((i) => i.idCliente !== idCliente));
    },

    /**
     * Mandar lo que espera, en orden y de a uno: dos mensajes seguidos tienen
     * que llegar en el orden en que se escribieron.
     */
    procesar: async () => {
      if (procesando) return;
      procesando = true;
      try {
        for (;;) {
          const item = get().items.find((i) => i.estado === "pendiente");
          if (!item) break;
          try {
            const fotos = item.fotos.length > 0 ? await subir(item) : [];
            const mensaje = await apiRequest<MensajeDeChat>(
              `/api/mobile/chats/${item.chatId}/mensajes`,
              {
                method: "POST",
                body: {
                  texto: item.texto,
                  fotos,
                  respondeAId: item.respondeA?.id ?? null,
                  idCliente: item.idCliente,
                },
              }
            );
            cambiar(get().items.filter((i) => i.idCliente !== item.idCliente));
            alEnviar.forEach((f) => f(item.chatId, mensaje));
          } catch (error) {
            if (esDeRed(error)) {
              // Sin camino al servidor, los demás tampoco van a salir ahora.
              break;
            }
            const motivo =
              error instanceof Error && error.message
                ? error.message
                : "No se pudo enviar";
            cambiar(
              get().items.map((i) =>
                i.idCliente === item.idCliente
                  ? { ...i, estado: "fallido", error: motivo }
                  : i
              )
            );
          }
        }
      } finally {
        procesando = false;
      }
    },
  };
});

// La app vuelve al frente: lo que esperaba sale ahora, no en el próximo tic.
AppState.addEventListener("change", (estado) => {
  if (estado === "active") void useColaDeEnvio.getState().procesar();
});

// Volvió la señal —lo dijo el sondeo del "Conectando…"—: lo mismo.
useConexion.subscribe((ahora, antes) => {
  if (ahora.enLinea && !antes.enLinea) void useColaDeEnvio.getState().procesar();
});

/** Para que el error de red de la cola nombre a dónde se fue, como el resto de la app. */
export const DESTINO_DE_LA_COLA = API_BASE_URL;

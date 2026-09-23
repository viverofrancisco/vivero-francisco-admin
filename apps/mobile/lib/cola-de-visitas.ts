import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { nuevoIdCliente } from "@vivero/shared";
import type { VisitaDetail } from "./types";
import type { UbicacionMarcada } from "./ubicacion";
import { apiRequest } from "./api";
import { useConexion } from "./conexion";

/**
 * La cola de trabajo de las visitas: lo que se hizo en el jardín y todavía no
 * llegó al servidor.
 *
 * Marcar la entrada, marcar la salida con el parte, y guardar fotos son tres
 * gestos que en el campo pasan sin señal la mitad de las veces. Los tres
 * quedan acá con la hora en que se hicieron y salen solos cuando vuelve la
 * red —o cuando la app vuelve al frente, o al próximo intento del reloj—. La
 * pantalla los muestra como hechos, con un ✓ de "esperando señal", igual que
 * un mensaje del chat.
 *
 * **La hora de una marca es la del teléfono cuando se apretó el botón**
 * (`marcadaEl`), porque sin señal no hay otra; el servidor guarda además cuándo
 * le llegó, y con eso la oficina ve si algo llegó tarde. Con señal la marca
 * sale en el acto y las dos horas son casi iguales.
 *
 * Se guarda entera en `AsyncStorage`: las fotos son archivos del teléfono, así
 * que cerrar la app con algo esperando no pierde nada. Sale **en orden**: la
 * entrada antes que la salida, y un trabajo que el servidor rechazó frena a
 * los que vienen detrás en la misma visita hasta que alguien lo reintente o lo
 * descarte —mandar la salida de una entrada rechazada solo suma otro rechazo.
 *
 * **Qué es un fallo y qué es esperar**, como en el chat: no llegar al servidor
 * es esperar; un 4xx es que el servidor lo miró y dijo que no, y queda
 * `fallido` con su motivo.
 */

const CLAVE = "visitas:cola-de-trabajo";
const REINTENTO_MS = 5000;

interface Base {
  id: string;
  visitaId: string;
  creadoEl: string;
  estado: "pendiente" | "fallido";
  error?: string;
  intentos: number;
  /** Se encoló sin señal. Viaja al servidor para que la marca quede anotada así. */
  sinConexion: boolean;
}

export interface FotoEnCola {
  uri: string;
  fileName: string;
  contentType: string;
  tareaId: string;
  /** Lo que el servidor firmó la última vez, para no subir dos veces. */
  key?: string;
  uploadUrl?: string;
  tipo?: string;
}

export type TrabajoEnCola =
  | (Base & {
      tipo: "ENTRADA";
      marcadaEl: string;
      ubicacion: UbicacionMarcada | null;
      dispositivo: string | null;
    })
  | (Base & {
      tipo: "SALIDA";
      marcadaEl: string;
      ubicacion: UbicacionMarcada | null;
      dispositivo: string | null;
      tareaIds: string[];
    })
  | (Base & {
      tipo: "ARCHIVOS";
      nuevas: FotoEnCola[];
      eliminar: string[];
      etiquetar: { id: string; tareaId: string }[];
    });

type Nuevo =
  | Omit<Extract<TrabajoEnCola, { tipo: "ENTRADA" }>, keyof Base>
  | Omit<Extract<TrabajoEnCola, { tipo: "SALIDA" }>, keyof Base>
  | Omit<Extract<TrabajoEnCola, { tipo: "ARCHIVOS" }>, keyof Base>;

interface Cola {
  items: TrabajoEnCola[];
  hidratada: boolean;
  hidratar: () => Promise<void>;
  encolar: (trabajo: Nuevo & { visitaId: string }) => void;
  reintentar: (id: string) => void;
  descartar: (id: string) => void;
  procesar: () => Promise<void>;
}

const alTerminar = new Set<(visitaId: string, visita: VisitaDetail | null) => void>();
let procesando = false;
let reloj: ReturnType<typeof setInterval> | null = null;
let hidratando: Promise<void> | null = null;

/** Avisar cuando un trabajo llegó, con la visita como quedó si el servidor la mandó. */
export function onHecho(f: (visitaId: string, visita: VisitaDetail | null) => void) {
  alTerminar.add(f);
  return () => {
    alTerminar.delete(f);
  };
}

/** Los trabajos de una visita, en el orden en que se hicieron. */
export function trabajosDe(items: TrabajoEnCola[], visitaId: string) {
  return items.filter((t) => t.visitaId === visitaId);
}

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
  return typeof status === "number" && (status === 0 || status >= 500);
}

export const useColaDeVisitas = create<Cola>((set, get) => {
  function cambiar(items: TrabajoEnCola[]) {
    set({ items });
    AsyncStorage.setItem(CLAVE, JSON.stringify(items)).catch(() => {});
    programar();
  }

  function programar() {
    const hayPendientes = get().items.some((i) => i.estado === "pendiente");
    if (hayPendientes && !reloj) {
      reloj = setInterval(() => void get().procesar(), REINTENTO_MS);
    } else if (!hayPendientes && reloj) {
      clearInterval(reloj);
      reloj = null;
    }
  }

  function actualizar(id: string, cambio: Partial<TrabajoEnCola>) {
    cambiar(
      get().items.map((i) => (i.id === id ? ({ ...i, ...cambio } as TrabajoEnCola) : i))
    );
  }

  /**
   * El próximo que puede salir: el pendiente más viejo cuya visita no tenga
   * uno rechazado antes que él.
   */
  function siguiente(): TrabajoEnCola | undefined {
    const frenadas = new Set(
      get()
        .items.filter((i) => i.estado === "fallido")
        .map((i) => i.visitaId)
    );
    return get().items.find(
      (i) => i.estado === "pendiente" && !frenadas.has(i.visitaId)
    );
  }

  async function subirFotos(item: Extract<TrabajoEnCola, { tipo: "ARCHIVOS" }>) {
    // Firmar solo las que no tienen firma: un reintento reutiliza la suya.
    const sinFirma = item.nuevas.filter((f) => !f.key);
    let nuevas = item.nuevas;
    if (sinFirma.length > 0) {
      const presign = await apiRequest<{
        uploads: { key: string; uploadUrl: string; tipo: string; contentType: string }[];
      }>(`/api/mobile/visitas/${item.visitaId}/media`, {
        method: "POST",
        body: {
          files: sinFirma.map((f) => ({ fileName: f.fileName, contentType: f.contentType })),
        },
      });
      let j = 0;
      nuevas = item.nuevas.map((f) =>
        f.key ? f : { ...f, ...presign.uploads[j++] }
      );
      actualizar(item.id, { nuevas });
    }
    for (const f of nuevas) {
      let blob: Blob;
      try {
        blob = await (await fetch(f.uri)).blob();
      } catch {
        throw new RespuestaDelServidor(400, "La foto ya no está en el teléfono. Vuelve a elegirla.");
      }
      const res = await fetch(f.uploadUrl!, {
        method: "PUT",
        headers: { "Content-Type": f.contentType },
        body: blob,
      });
      if (res.status === 403) {
        // La firma venció: se vuelve a pedir la próxima vez.
        actualizar(item.id, {
          nuevas: nuevas.map((x) => (x === f ? { ...x, key: undefined, uploadUrl: undefined } : x)),
        });
        throw new RespuestaDelServidor(503, "La subida venció; se vuelve a intentar.");
      }
      if (!res.ok) throw new RespuestaDelServidor(res.status, "No pudimos subir uno de los archivos.");
    }
    return nuevas;
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
          const guardados = crudo ? (JSON.parse(crudo) as TrabajoEnCola[]) : [];
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

    encolar: (trabajo) => {
      const item = {
        ...trabajo,
        id: nuevoIdCliente(),
        creadoEl: new Date().toISOString(),
        estado: "pendiente",
        intentos: 0,
        sinConexion: !useConexion.getState().enLinea,
      } as TrabajoEnCola;
      cambiar([...get().items, item]);
      void get().procesar();
    },

    reintentar: (id) => {
      actualizar(id, { estado: "pendiente", error: undefined });
      void get().procesar();
    },

    descartar: (id) => {
      cambiar(get().items.filter((i) => i.id !== id));
    },

    procesar: async () => {
      if (procesando) return;
      procesando = true;
      try {
        for (;;) {
          const item = siguiente();
          if (!item) break;
          try {
            let visita: VisitaDetail | null = null;
            if (item.tipo === "ENTRADA" || item.tipo === "SALIDA") {
              visita = await apiRequest<VisitaDetail>(
                `/api/mobile/visitas/${item.visitaId}/marca`,
                {
                  method: "POST",
                  body: {
                    tipo: item.tipo,
                    ubicacion: item.ubicacion,
                    dispositivo: item.dispositivo,
                    marcadaEl: item.marcadaEl,
                    // Sin señal al marcar, o con la señal cortada a mitad del
                    // primer intento: en los dos casos llegó después.
                    sinConexion: item.sinConexion || item.intentos > 0,
                    ...(item.tipo === "SALIDA" ? { tareaIds: item.tareaIds } : {}),
                  },
                }
              );
            } else {
              const nuevas = await subirFotos(item);
              await apiRequest(`/api/mobile/visitas/${item.visitaId}/media`, {
                method: "PUT",
                body: {
                  files: nuevas.map((f) => ({ key: f.key, tipo: f.tipo, tareaId: f.tareaId })),
                  eliminar: item.eliminar,
                  etiquetar: item.etiquetar,
                },
              });
            }
            cambiar(get().items.filter((i) => i.id !== item.id));
            alTerminar.forEach((f) => f(item.visitaId, visita));
          } catch (error) {
            if (esDeRed(error)) {
              actualizar(item.id, { intentos: item.intentos + 1 });
              break;
            }
            const motivo =
              error instanceof Error && error.message ? error.message : "No se pudo guardar";
            actualizar(item.id, { estado: "fallido", error: motivo, intentos: item.intentos + 1 });
          }
        }
      } finally {
        procesando = false;
      }
    },
  };
});

AppState.addEventListener("change", (estado) => {
  if (estado === "active") void useColaDeVisitas.getState().procesar();
});

useConexion.subscribe((ahora, antes) => {
  if (ahora.enLinea && !antes.enLinea) void useColaDeVisitas.getState().procesar();
});

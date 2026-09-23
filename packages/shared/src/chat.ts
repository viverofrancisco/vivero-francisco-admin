import { z } from "zod";

/**
 * Los chats internos del equipo: la oficina y la gente de campo hablando entre
 * ellas. **Nunca con un cliente** — el cliente dice lo suyo en la calificación
 * de su visita.
 *
 * Estos esquemas son de las dos aplicaciones: el portal y la app mandan los
 * mismos mensajes por las mismas reglas, y tenerlos dos veces ya había hecho
 * antes que una aceptara diez archivos y la otra veinte.
 */

export const MAX_FOTOS_POR_MENSAJE = 10;

export const crearChatSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre").max(80),
  /**
   * Quién está adentro. Quien lo crea se agrega solo del lado del servidor:
   * armar una conversación y no poder abrirla no le sirve a nadie.
   */
  miembrosIds: z.array(z.string().min(1)).default([]),
});
export type CrearChatBody = z.infer<typeof crearChatSchema>;

export const actualizarChatSchema = z
  .object({
    nombre: z.string().trim().min(1).max(80).optional(),
    /** Reemplaza a los miembros actuales: lo que llega **es** el chat. */
    miembrosIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (v) => v.nombre !== undefined || v.miembrosIds !== undefined,
    "No hay nada que cambiar."
  );
export type ActualizarChatBody = z.infer<typeof actualizarChatSchema>;

const fotoDeMensajeSchema = z.object({
  key: z.string().min(1),
  url: z.string().min(1),
  /**
   * Cómo se llamaba el archivo. Es lo único por lo que después se puede
   * **buscar** una foto: su clave en R2 es un uuid.
   */
  nombre: z.string().max(200).optional(),
  /** Imagen o video. Lo decide el servidor al firmar la subida, por el tipo de contenido. */
  tipo: z.enum(["imagen", "video"]).optional(),
});

/**
 * Un mensaje es texto, fotos, o las dos cosas — pero **algo tiene que traer**:
 * un mensaje vacío ocupa un renglón en la conversación de todos y no dice nada.
 */
export const enviarMensajeSchema = z
  .object({
    texto: z.string().max(4000).optional().nullable(),
    fotos: z.array(fotoDeMensajeSchema).max(MAX_FOTOS_POR_MENSAJE).optional(),
    /** A cuál contesta, como en WhatsApp. Tiene que ser del mismo chat. */
    respondeAId: z.string().min(1).optional().nullable(),
    /**
     * El id que le puso la pantalla al mandarlo. Con él, volver a enviar un
     * mensaje que se cortó a mitad de camino no lo duplica: el servidor
     * reconoce el reintento y devuelve el que ya guardó.
     */
    idCliente: z.string().min(8).max(80).optional(),
  })
  .refine(
    (v) => Boolean(v.texto && v.texto.trim()) || (v.fotos?.length ?? 0) > 0,
    { message: "El mensaje no puede estar vacío." }
  );
export type EnviarMensajeBody = z.infer<typeof enviarMensajeSchema>;

export const mensajesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /**
   * Abrir la conversación **alrededor de un mensaje**, no por el final: es lo
   * que hace falta cuando se llega desde el buscador. Trae los de antes y los
   * de después en la misma página.
   */
  alrededorDe: z.string().optional(),
});
export type MensajesQuery = z.infer<typeof mensajesQuerySchema>;

/** Pedir las URLs firmadas para subir las fotos de un mensaje. */
export const chatUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z
          .string()
          .min(1)
          // Imágenes y videos, como en las fotos de una visita: el tipo es lo
          // que se **firma**, así que la regla vive acá y no en la pantalla.
          .refine(
            (t) => t.startsWith("image/") || t.startsWith("video/"),
            "Solo se pueden subir imágenes o videos"
          ),
      })
    )
    .min(1)
    .max(MAX_FOTOS_POR_MENSAJE),
});
export type ChatUploadUrlsBody = z.infer<typeof chatUploadUrlsSchema>;

/** Buscar entre los mensajes de los chats donde uno está. */
export const busquedaDeMensajesSchema = z.object({
  q: z.string().trim().min(2, "Escribe al menos dos letras").max(100),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type BusquedaDeMensajes = z.infer<typeof busquedaDeMensajesSchema>;

/**
 * Cómo va un mensaje, visto desde quien lo mandó. Los vistos de WhatsApp:
 *
 * - `pendiente`: está en la pantalla pero todavía no llegó al servidor (un ✓).
 * - `fallido`: el servidor lo rechazó, y hay que reintentar o descartarlo.
 * - `enviado`: el servidor lo tiene (✓✓).
 * - `leido`: lo leyeron **todos** los demás miembros (✓✓ azules).
 *
 * "Entregado" no existe: no hay forma de saber si el teléfono del otro lo
 * recibió, y un estado que no se puede saber es un estado que miente.
 */
export type EstadoDeMensaje = "pendiente" | "fallido" | "enviado" | "leido";

/**
 * Un mensaje como lo ven las dos aplicaciones. Es lo que devuelve el
 * `chat.service` del portal, con las fechas ya como texto ISO.
 */
export interface MensajeDeChat {
  id: string;
  texto: string | null;
  fotos: { id: string; url: string; tipo: string; nombre?: string | null }[];
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
    /** La primera foto o video del mensaje citado, para la miniatura. */
    miniatura: { url: string; tipo: string } | null;
  } | null;
  /** El id que le puso la pantalla al mandarlo, para reconocerlo al volver. */
  idCliente: string | null;
  estado: EstadoDeMensaje;
  /** Por qué falló, cuando `estado` es `fallido`. */
  error?: string;
}

/** Quién leyó un mensaje y cuándo: la info del mensaje. */
export interface InfoDeMensaje {
  mensaje: MensajeDeChat;
  leidoPor: { id: string; nombre: string; leidoEl: string }[];
  sinLeer: { id: string; nombre: string }[];
}

/** Una foto que espera en la cola, todavía en el aparato que la eligió. */
export interface FotoEnCola {
  /** Dónde está el archivo: una URL de objeto en el navegador, un `file://` en el teléfono. */
  uri: string;
  nombre: string;
  contentType: string;
  tipo: "imagen" | "video";
}

/**
 * Un mensaje que salió de la pantalla y todavía no del aparato.
 *
 * Aparece en la conversación en el acto y se manda después, como en WhatsApp:
 * sin señal se queda esperando, y cuando vuelve la señal sale solo. Se guarda
 * en el aparato para que cerrar la app no lo pierda.
 */
export interface MensajeEnCola {
  idCliente: string;
  chatId: string;
  texto: string | null;
  fotos: FotoEnCola[];
  /** Lo citado, copiado, para dibujar la cita antes de que el servidor conteste. */
  respondeA: MensajeDeChat["respondeA"];
  creadoEl: string;
  estado: "pendiente" | "fallido";
  error?: string;
}

/** Un id para el mensaje que se está por mandar. */
export function nuevoIdCliente(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cripto?.randomUUID) return cripto.randomUUID();
  const azar = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${azar()}-${azar()}`;
}

/** Cómo se dibuja un mensaje de la cola mientras no vuelve del servidor. */
export function mensajeOptimista(
  item: MensajeEnCola,
  autor: { id: string; nombre: string }
): MensajeDeChat {
  return {
    id: `local:${item.idCliente}`,
    texto: item.texto,
    fotos: item.fotos.map((f, i) => ({
      id: `${item.idCliente}:${i}`,
      url: f.uri,
      tipo: f.tipo,
      nombre: f.nombre,
    })),
    createdAt: item.creadoEl,
    borrado: false,
    autorId: autor.id,
    autorNombre: autor.nombre,
    mio: true,
    respondeA: item.respondeA,
    idCliente: item.idCliente,
    estado: item.estado,
    error: item.error,
  };
}

/**
 * Junta lo que vino del servidor con lo que espera en la cola, del más viejo
 * al más nuevo: la cola va al final, que es donde está lo que se acaba de
 * escribir. Un mensaje del servidor que trae el `idCliente` de uno de la cola
 * **es** ese mensaje, ya llegado, y la cola deja de mostrarlo.
 */
export function mezclarConLaCola(
  delServidor: MensajeDeChat[],
  enCola: MensajeEnCola[],
  autor: { id: string; nombre: string }
): MensajeDeChat[] {
  const llegados = new Set(
    delServidor.map((m) => m.idCliente).filter((x): x is string => Boolean(x))
  );
  return [
    ...delServidor,
    ...enCola
      .filter((p) => !llegados.has(p.idCliente))
      .map((p) => mensajeOptimista(p, autor)),
  ];
}

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

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

/** Qué es un adjunto de chat: lo decide el servidor por el tipo de contenido firmado. */
export type TipoDeAdjunto = "imagen" | "video" | "documento";

/**
 * Los documentos que se pueden mandar en un chat: lo que la oficina se pasa
 * hoy por WhatsApp —PDF, Word, Excel, PowerPoint, texto y comprimidos—. Es
 * una lista y no "todo lo que no sea imagen" porque el tipo es lo que se
 * **firma**: R2 guarda lo que llegue con la firma que le dimos, y un
 * ejecutable con nombre de PDF es exactamente lo que no se quiere ahí.
 */
const DOCUMENTOS_PERMITIDOS = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

export function esContenidoPermitidoEnChat(contentType: string): boolean {
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("video/") ||
    DOCUMENTOS_PERMITIDOS.has(contentType)
  );
}

/** El tipo de adjunto que le corresponde a un tipo de contenido. */
export function tipoDeArchivo(contentType: string): TipoDeAdjunto {
  if (contentType.startsWith("image/")) return "imagen";
  if (contentType.startsWith("video/")) return "video";
  return "documento";
}

/** "1,7 MB", "185 KB": el tamaño como lo lee una persona. */
export function tamanoLegible(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** La extensión de un nombre de archivo, en mayúsculas: "PDF", "DOCX". */
export function extensionDe(nombre: string | null | undefined): string | null {
  const ext = nombre?.split(".").pop();
  return ext && ext.length <= 5 && ext !== nombre ? ext.toUpperCase() : null;
}

/** Cómo se nombra un adjunto cuando no hay texto que lo acompañe. */
export function etiquetaDeAdjuntos(tipo: string | undefined, cuantos: number): string {
  if (cuantos > 1) return `📎 ${cuantos} archivos`;
  if (tipo === "video") return "🎥 Video";
  if (tipo === "documento") return "📄 Documento";
  return "📷 Foto";
}

/**
 * La foto del grupo: una clave ya subida a R2 bajo el prefijo del chat, con
 * su URL pública. `null` quita la que había.
 */
export const imagenDeChatSchema = z
  .object({ key: z.string().min(1), url: z.string().min(1) })
  .nullable();

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
    /** La foto del grupo. Se sube antes con las URLs firmadas del chat. */
    imagen: imagenDeChatSchema.optional(),
  })
  .refine(
    (v) =>
      v.nombre !== undefined ||
      v.miembrosIds !== undefined ||
      v.imagen !== undefined,
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
  /** Imagen, video o documento. Lo decide el servidor al firmar la subida, por el tipo de contenido. */
  tipo: z.enum(["imagen", "video", "documento"]).optional(),
  /** Bytes, para los documentos. */
  tamano: z.number().int().min(0).optional().nullable(),
});

/** Qué se puede compartir en un chat, como un contacto en WhatsApp. */
export const TIPOS_DE_REFERENCIA = ["visita", "cliente", "producto"] as const;
export type TipoDeReferencia = (typeof TIPOS_DE_REFERENCIA)[number];

/** Lo que manda la pantalla: qué es y cuál. El servidor arma la tarjeta. */
export const referenciaDeMensajeSchema = z.object({
  tipo: z.enum(TIPOS_DE_REFERENCIA),
  id: z.string().min(1),
});

/**
 * La tarjeta como se dibuja: el tipo y el id para abrir la ficha, y el título
 * y el detalle copiados al mandar. La ficha puede cambiar o archivarse
 * después; la tarjeta dice lo que se compartió ese día.
 */
export interface ReferenciaEnMensaje {
  tipo: TipoDeReferencia;
  id: string;
  titulo: string;
  detalle: string;
}

/**
 * Qué ficha compartida puede abrir cada rol, decidido por el rol y nada más:
 * un cliente y un producto son de la oficina; una visita la abre cualquiera
 * del equipo, y si es *suya* lo dice el servidor al abrirla. Preguntar por
 * cada visita en cada sondeo costaría una consulta por tarjeta; lo que sale
 * gratis es marcar la tarjeta que de entrada no se va a poder abrir.
 */
export function puedeAbrirReferencia(rol: string, tipo: TipoDeReferencia): boolean {
  if (tipo === "visita") return true;
  return rol === "ADMIN" || rol === "STAFF";
}

/**
 * Lo que se dice cuando alguien no puede abrir una ficha: el aviso al tocar
 * la tarjeta del chat, y la pantalla que se abre en su lugar cuando se llega
 * por la URL. Las mismas palabras en las dos apps, y **solo esas**: explicar
 * quién sí puede ("los clientes los abre la oficina") no le sirve a quien no
 * puede. La tarjeta en sí se ve como cualquier otra.
 */
export const SIN_ACCESO_A: Record<TipoDeReferencia, string> = {
  visita: "No tienes acceso a esta visita",
  cliente: "No tienes acceso a este cliente",
  producto: "No tienes acceso a este producto",
};

/**
 * La vista previa de una ficha compartida: lo que se lee **sin salir del
 * chat**. Tocar la tarjeta abría la ficha entera, y volver era perder el
 * hilo; ahora abre esto —un diálogo en el escritorio, una hoja en el
 * teléfono— con lo esencial en filas de etiqueta y valor, y un *Ver ficha*
 * para quien sí quiere irse. Filas genéricas a propósito: una sola pantalla
 * sirve para los tres tipos, y el servidor decide qué vale la pena mostrar.
 */
export interface VistaPreviaDeReferencia {
  tipo: TipoDeReferencia;
  id: string;
  titulo: string;
  subtitulo: string;
  /** Un estado, si lo tiene: "Programada", "En curso"... */
  estado?: string;
  /** Un valor puede traer saltos de línea (una propiedad por renglón). */
  filas: { etiqueta: string; valor: string }[];
}

/** El selector de qué compartir: por tipo, con texto para buscar. */
export const compartiblesQuerySchema = z.object({
  tipo: z.enum(TIPOS_DE_REFERENCIA),
  q: z.string().trim().max(100).optional(),
});

/**
 * Un mensaje es texto, fotos, una ficha compartida, o varias de esas cosas —
 * pero **algo tiene que traer**: un mensaje vacío ocupa un renglón en la
 * conversación de todos y no dice nada.
 */
export const enviarMensajeSchema = z
  .object({
    texto: z.string().max(4000).optional().nullable(),
    fotos: z.array(fotoDeMensajeSchema).max(MAX_FOTOS_POR_MENSAJE).optional(),
    /** Una visita, un cliente o un producto, compartidos como tarjeta. */
    referencia: referenciaDeMensajeSchema.optional().nullable(),
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
    (v) =>
      Boolean(v.texto && v.texto.trim()) ||
      (v.fotos?.length ?? 0) > 0 ||
      Boolean(v.referencia),
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

/**
 * Lo que se mandó en un chat, aparte de la conversación: las fotos y videos
 * en una grilla, y los mensajes con enlaces en una lista. Es la forma rápida
 * de volver a encontrar un archivo sin scrollear meses, como en WhatsApp.
 */
export const mediosDelChatQuerySchema = z.object({
  tipo: z.enum(["archivos", "enlaces", "documentos"]),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type MediosDelChatQuery = z.infer<typeof mediosDelChatQuerySchema>;

/** Un archivo mandado en el chat, para la grilla. */
/** Una foto con sus versiones; `null` mientras no estén, y siempre para videos y documentos. */
export interface ConVersiones {
  url: string;
  urlMovil?: string | null;
  urlTablet?: string | null;
  urlEscritorio?: string | null;
  /** El cuadro de un video, para la burbuja. Las fotos no lo tienen. */
  posterUrl?: string | null;
}

/** La versión para una burbuja o una grilla: la chica, o el original si aún no está. */
export function urlParaMiniatura(f: ConVersiones): string {
  return f.urlMovil ?? f.url;
}

/**
 * La versión para ver la foto grande, según el ancho de la pantalla que la
 * abre: en un teléfono o una tablet la de 1024; en un escritorio la de 2048.
 * El original si todavía no están.
 */
export function urlParaVerGrande(f: ConVersiones, anchoDePantalla: number): string {
  if (anchoDePantalla >= 1024) return f.urlEscritorio ?? f.urlTablet ?? f.url;
  // Un video tiene solo la móvil (el 720p): en un teléfono es esa.
  return f.urlTablet ?? f.urlMovil ?? f.url;
}

export interface ArchivoDelChat extends ConVersiones {
  id: string;
  mensajeId: string;
  tipo: string;
  nombre: string | null;
  tamano?: number | null;
  createdAt: string;
}

/** Un mensaje con enlaces, para la lista. */
export interface EnlaceDelChat {
  mensajeId: string;
  autorNombre: string;
  texto: string;
  urls: string[];
  createdAt: string;
}

/** Pedir las URLs firmadas para subir las fotos de un mensaje. */
export const chatUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z
          .string()
          .min(1)
          // Imágenes, videos y los documentos de la lista: el tipo es lo que
          // se **firma**, así que la regla vive acá y no en la pantalla.
          .refine(
            esContenidoPermitidoEnChat,
            "Solo se pueden mandar imágenes, videos y documentos (PDF, Word, Excel, PowerPoint, texto o ZIP)"
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
  /** Los adjuntos: fotos, videos y documentos. Se llaman `fotos` desde antes de que hubiera otros. */
  fotos: (ConVersiones & { id: string; tipo: string; nombre?: string | null; tamano?: number | null })[];
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
  /** Una visita, un cliente o un producto compartidos, como tarjeta. */
  referencia?: ReferenciaEnMensaje | null;
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
  tipo: TipoDeAdjunto;
  /** Bytes, para los documentos. */
  tamano?: number | null;
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
  /** La ficha compartida, con su tarjeta ya armada por el selector. */
  referencia?: ReferenciaEnMensaje | null;
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
      tamano: f.tamano ?? null,
    })),
    createdAt: item.creadoEl,
    borrado: false,
    autorId: autor.id,
    autorNombre: autor.nombre,
    mio: true,
    respondeA: item.respondeA,
    referencia: item.referencia ?? null,
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

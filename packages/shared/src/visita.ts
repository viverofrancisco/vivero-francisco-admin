import { z } from "zod";

/**
 * Espejo de `EstadoVisita` en Prisma.
 *
 * `EN_CURSO` es la que ya tiene a alguien registrando lo que hizo pero que
 * nadie dio por terminada. Cerrarla —`COMPLETADA` o `INCOMPLETA`— es de
 * oficina; el jardinero solo carga su parte.
 */
export const estadoVisitaSchema = z.enum([
  "PROGRAMADA",
  "EN_CURSO",
  "COMPLETADA",
  "INCOMPLETA",
  "CANCELADA",
]);
export type EstadoVisita = z.infer<typeof estadoVisitaSchema>;

export const cancelVisitaSchema = z.object({
  motivo: z.string().max(500).optional(),
});
export type CancelVisitaBody = z.infer<typeof cancelVisitaSchema>;

// Optional uploaded media keys (after presigned PUT to S3/R2). The server
// creates VisitaMedia rows from these on completion.
/**
 * Una foto o video ya subido, listo para engancharse a la visita.
 *
 * `tareaId` es la etiqueta, y se manda **al subir**: desde el teléfono se elige
 * entre las tareas que esa persona acaba de marcar, que es el único momento en
 * que alguien recuerda de qué era cada foto. De ahí sale, después, la sección
 * del informe donde la foto cae sola.
 */
export const mediaItemSchema = z.object({
  key: z.string().min(1),
  tipo: z.enum(["imagen", "video"]),
  tareaId: z.string().min(1).nullable().optional(),
});

/**
 * El parte de una persona: sus horas y las tareas que **ella** hizo.
 *
 * Es lo que reemplaza a "completar la visita" del lado del jardinero. Cerrarla
 * pasó a ser de oficina, porque decir que el trabajo está terminado es mirar lo
 * que cargaron todos y qué falta de lo que se exigía.
 *
 * `tareaIds` es el estado final, no un agregado: lo que llega reemplaza lo que
 * esa persona tuviera cargado, porque el formulario es una lista de casillas y
 * sin esto no habría forma de desmarcar algo puesto por error.
 */
export const parteVisitaSchema = z.object({
  /** Solo la oficina puede cargar por otro; a un jardinero se le ignora. */
  personalId: z.string().min(1).optional(),
  /**
   * Corrección de los instantes marcados, en ISO.
   *
   * Eran `"HH:MM"`. La entrada y la salida ahora se marcan con un botón que
   * sella el momento —ver `marcaVisitaSchema`—, y esto es lo que se manda
   * cuando hay que corregir uno. Un instante y no una hora suelta: quien entra
   * a las 23:50 y sale a las 00:30 tenía una salida anterior a su entrada.
   */
  entradaEl: z.string().optional().nullable(),
  salidaEl: z.string().optional().nullable(),
  tareaIds: z.array(z.string().min(1)),
  media: z.array(mediaItemSchema).optional(),
});
export type ParteVisitaBody = z.infer<typeof parteVisitaSchema>;

/**
 * Dónde estaba quien marcó. Opcional, y validada igual.
 *
 * Una latitud de 200 no existe, y guardarla sería guardar basura que después
 * nadie sabe leer. `precision` es el radio en metros que informa el
 * dispositivo; `simulada` sale de Android cuando la ubicación viene de una app
 * de mock — iOS no lo dice, así que ahí es `null`, que significa "no sabemos"
 * y no "no simulada".
 */
export const ubicacionMarcaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().min(0).optional().nullable(),
  simulada: z.boolean().optional().nullable(),
});
export type UbicacionMarcaBody = z.infer<typeof ubicacionMarcaSchema>;

/**
 * Marcar entrada o salida. **Solo desde la app.**
 *
 * El servidor sella el momento: no se manda una hora, porque una hora que manda
 * el cliente es una hora que el cliente elige. Al salir se dice qué se hizo,
 * que es cuando recién se sabe.
 *
 * No lleva `personalId`: marca el que marca. La oficina no marca por nadie —lo
 * que hace cuando a alguien se le murió el teléfono es corregir el instante con
 * `parteVisitaSchema`, que es otra cosa y se llama distinto.
 *
 * `dispositivo` identifica la **instalación** de la app, no a la persona: sirve
 * para ver si dos compañeros marcaron desde el mismo teléfono, que es lo que
 * pasa cuando uno le presta la cuenta al otro.
 *
 * La ubicación no se exige. Falta señal adentro de una pared, con la batería
 * baja o con el teléfono en la camioneta, y negarse a registrar por eso deja a
 * alguien sin poder anotar el trabajo que sí hizo.
 */
export const marcaVisitaSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("ENTRADA"),
    ubicacion: ubicacionMarcaSchema.optional().nullable(),
    dispositivo: z.string().max(64).optional().nullable(),
  }),
  z.object({
    tipo: z.literal("SALIDA"),
    ubicacion: ubicacionMarcaSchema.optional().nullable(),
    dispositivo: z.string().max(64).optional().nullable(),
    tareaIds: z.array(z.string().min(1)),
    media: z.array(mediaItemSchema).optional(),
  }),
]);
export type MarcaVisitaBody = z.infer<typeof marcaVisitaSchema>;

/** Cerrar la visita. Solo ADMIN/STAFF. */
export const completeVisitaSchema = z.object({
  notas: z.string().max(2000).optional().nullable(),
  fechaRealizada: z.string().optional(), // ISO date "YYYY-MM-DD"
});
export type CompleteVisitaBody = z.infer<typeof completeVisitaSchema>;

export const incompleteVisitaSchema = z.object({
  motivo: z.string().min(1).max(2000),
  notas: z.string().max(2000).optional().nullable(),
  fechaRealizada: z.string().optional(),
});
export type IncompleteVisitaBody = z.infer<typeof incompleteVisitaSchema>;

/**
 * Cuántos archivos entran en un pedido de subida.
 *
 * Es un tope por llamada, no por visita: se puede volver a subir. Existe para
 * que un cliente roto no pida mil URLs firmadas de una, no porque veinte fotos
 * sean muchas para una visita.
 */
export const MAX_ARCHIVOS_POR_SUBIDA = 20;

/**
 * Un archivo que se quiere subir a una visita.
 *
 * El `contentType` se valida acá porque es lo que se firma: la URL prefirmada
 * sale con ese tipo y el bucket lo acepta sin preguntar. Sin este filtro, un
 * pedido armado a mano subía un ejecutable y quedaba guardado como "imagen"
 * —`tipo` se deduce de si empieza con `video/`, y todo lo demás cae en imagen.
 */
export const archivoSubibleSchema = z.object({
  fileName: z.string().min(1),
  contentType: z
    .string()
    .min(1)
    .refine(
      (t) => t.startsWith("image/") || t.startsWith("video/"),
      "Solo se pueden subir imágenes o videos"
    ),
});

// Schema for /api/mobile/visitas/[id]/media POST (request presigned URLs)
export const requestUploadUrlsSchema = z.object({
  files: z.array(archivoSubibleSchema).min(1).max(MAX_ARCHIVOS_POR_SUBIDA),
});
export type RequestUploadUrlsBody = z.infer<typeof requestUploadUrlsSchema>;

/**
 * Agendar una visita: cuándo, para quién y con quién.
 *
 * **Sin productos.** Llevaba una lista de productos del catálogo, porque de ahí
 * salía después lo que se le cobraba al cliente; eso se terminó. Lo que se hace
 * en una visita son tareas, y las carga cada jardinero al terminar. Lo único
 * que se decide al agendar es si alguna es **obligatoria**.
 */
export const createVisitasSchema = z.object({
  clienteId: z.string().min(1),
  fechas: z.array(z.string().min(1)).min(1, "Selecciona al menos una fecha"),
  /** Lo que esta visita exige que se haga. Opcional. */
  tareasObligatoriasIds: z.array(z.string().min(1)).optional(),
  /** De qué plan es, si es de alguno. */
  suscripcionId: z.string().nullable().optional(),
  grupoId: z.string().optional().nullable(),
  notas: z.string().trim().max(1000).optional().nullable(),
  personalIds: z.array(z.string()).optional(),
});
export type CreateVisitasBody = z.infer<typeof createVisitasSchema>;

export const visitasListQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type VisitasListQuery = z.infer<typeof visitasListQuerySchema>;

/**
 * Lo que el cliente dice de una visita terminada.
 *
 * Las estrellas son obligatorias porque son la pregunta; el texto y las fotos
 * no, porque la mayoría no escribe nada y obligarlo sería quedarse sin las
 * estrellas también.
 *
 * Las fotos **reemplazan** a las que hubiera: lo que manda el formulario es el
 * estado final, y sumar dejaría sin forma de sacar una cargada por error.
 */
export const calificacionVisitaSchema = z.object({
  estrellas: z.number().int().min(1).max(5),
  comentario: z.string().max(2000).optional().nullable(),
  fotos: z.array(z.object({ key: z.string().min(1) })).max(10).optional(),
});
export type CalificacionVisitaBody = z.infer<typeof calificacionVisitaSchema>;

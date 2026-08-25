import { z } from "zod";

// Mirrors prisma's EstadoVisita. Will likely be extended in Phase 2 to track
// cliente confirmation state — see plan.
export const estadoVisitaSchema = z.enum([
  "PROGRAMADA",
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
const mediaItemSchema = z.object({
  key: z.string().min(1),
  tipo: z.enum(["imagen", "video"]),
  // Servicio de la visita al que corresponde la foto. Opcional.
  productoId: z.string().min(1).nullable().optional(),
});

export const completeVisitaSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  fechaRealizada: z.string().optional(), // ISO date "YYYY-MM-DD"
  horaEntrada: z.string().optional().nullable(), // "HH:MM"
  horaSalida: z.string().optional().nullable(),
  media: z.array(mediaItemSchema).optional(),
});
export type CompleteVisitaBody = z.infer<typeof completeVisitaSchema>;

export const incompleteVisitaSchema = z.object({
  reason: z.string().min(1).max(2000),
  fechaRealizada: z.string().optional(),
  horaEntrada: z.string().optional().nullable(),
  horaSalida: z.string().optional().nullable(),
  media: z.array(mediaItemSchema).optional(),
});
export type IncompleteVisitaBody = z.infer<typeof incompleteVisitaSchema>;

// Schema for /api/mobile/visitas/[id]/media POST (request presigned URLs)
export const requestUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.string().min(1),
      })
    )
    .min(1)
    .max(20),
});
export type RequestUploadUrlsBody = z.infer<typeof requestUploadUrlsSchema>;

/** Sin plata: agendar y cobrar son dos momentos distintos. */
export const productoDeVisitaSchema = z.object({
  productoId: z.string().min(1),
  /**
   * Si el cliente tiene un plan con este producto, ¿esta visita se descuenta de
   * él? Por omisión sí — es el caso normal y lo que hacían los clientes viejos
   * de la API. En `false` la visita queda como trabajo suelto y se cotiza.
   */
});

export const createVisitasSchema = z.object({
  clienteId: z.string().min(1),
  /** Productos que cubre la visita. */
  productos: z
    .array(productoDeVisitaSchema)
    .min(1, "Selecciona al menos un producto"),
  fechas: z.array(z.string().min(1)).min(1, "Selecciona al menos una fecha"),
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

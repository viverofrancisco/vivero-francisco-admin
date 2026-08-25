import { z } from "zod/v4";

/**
 * Una foto de una sección viene de una visita (`visitaMediaId`) o se subió
 * directo al informe (`key`, ya en R2). Exactamente una de las dos.
 */
export const informeSeccionFotoSchema = z
  .object({
    visitaMediaId: z.string().min(1).nullable().optional(),
    key: z.string().min(1).nullable().optional(),
  })
  .refine((f) => Boolean(f.visitaMediaId) !== Boolean(f.key), {
    message: "Cada foto debe venir de una visita o ser una imagen subida.",
  });

export const informeSeccionSchema = z.object({
  /** Servicio que origina la sección. Null u omitido = sección personalizada. */
  productoId: z.string().nullable().optional(),
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(4000).nullable().optional(),
  fotos: z.array(informeSeccionFotoSchema).default([]),
});

export const informeFirmanteSchema = z.object({
  nombre: z.string().min(1).max(100),
  cedula: z.string().max(30).nullable().optional(),
});

/** Cuerpo compartido por POST /informes (crear) y PUT /informes/[id] (regenerar). */
export const informeGenerateSchema = z.object({
  clienteId: z.string().min(1),
  titulo: z.string().min(1).max(200),
  visitaIds: z.array(z.string().min(1)).min(1),
  firmantes: z.array(informeFirmanteSchema).min(1).max(3),
  secciones: z.array(informeSeccionSchema).min(1),
});

export type InformeGenerateBody = z.infer<typeof informeGenerateSchema>;

/** Cuerpo de POST /informes/uploads — pide URLs prefirmadas para las imágenes. */
export const informeUploadUrlsSchema = z.object({
  clienteId: z.string().min(1),
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

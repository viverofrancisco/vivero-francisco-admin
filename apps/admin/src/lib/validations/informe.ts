import { z } from "zod/v4";

/**
 * Una foto de una sección viene de una visita (`visitaMediaId`) o se subió
 * directo al informe (`key`, ya en R2). Exactamente una de las dos.
 */
export const informeSeccionFotoSchema = z
  .object({
    visitaMediaId: z.string().min(1).nullable().optional(),
    /** De la biblioteca. Es por donde entran las nuevas. */
    mediaId: z.string().min(1).nullable().optional(),
    /** Subida directo al informe. Queda por los que ya existían. */
    key: z.string().min(1).nullable().optional(),
  })
  // Exactamente uno: de dónde viene el archivo decide de quién es, y por lo
  // tanto quién lo borra. Dos orígenes a la vez no tendrían respuesta.
  .refine(
    (f) =>
      [f.visitaMediaId, f.mediaId, f.key].filter(Boolean).length === 1,
    {
      message:
        "Cada foto viene de una visita, de la biblioteca, o es una subida suelta.",
    }
  );

export const informeSeccionSchema = z.object({
  /** Servicio que origina la sección. Null u omitido = sección personalizada. */
  productoId: z.string().nullable().optional(),
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(4000).nullable().optional(),
  fotos: z.array(informeSeccionFotoSchema).default([]),
  /** Cómo se imprime. Los defaults son lo que se venía imprimiendo. */
  saltoDePagina: z.boolean().default(false),
  fotosPorFila: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const informeFirmanteSchema = z.object({
  nombre: z.string().min(1).max(100),
  cedula: z.string().max(30).nullable().optional(),
});

/** Cuerpo de POST /informes. No hay PUT: un informe no se edita. */
export const informeGenerateSchema = z.object({
  clienteId: z.string().min(1),
  titulo: z.string().min(1).max(200),
  /** La que se imprime, `YYYY-MM-DD`. Ausente = hoy. */
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional(),
  /**
   * Qué visitas cubre. **Puede ir vacío**: un informe sin visitas es el que se
   * arma a mano —un resumen de temporada, una propuesta— y la lista es lo que
   * lo llena solo cuando las hay, no un requisito.
   */
  visitaIds: z.array(z.string().min(1)),
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

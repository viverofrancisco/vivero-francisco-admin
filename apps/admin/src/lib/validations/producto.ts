import { z } from "zod/v4";

/**
 * Los ejes de un bien y sus valores.
 *
 * Cada uno viaja **con su id** cuando ya existía. Sin eso, renombrar "Rojo" a
 * "Rojo intenso" sería borrar un valor y crear otro, y todas las variantes
 * rojas se irían con su stock por un cambio de texto.
 */
export const opcionesSchema = z.object({
  opciones: z
    .array(
      z.object({
        id: z.string().min(1).nullable().optional(),
        nombre: z.string().min(1, "La opción necesita un nombre"),
        valores: z
          .array(
            z.object({
              id: z.string().min(1).nullable().optional(),
              valor: z.string().min(1),
            })
          )
          .min(1, "Cada opción necesita al menos un valor"),
      })
    )
    .max(3),
  /**
   * Sacar un eje borra las variantes que dependían de él. Con inventario
   * cargado eso no pasa en silencio: hace falta decir que sí, después de ver
   * cuáles se van y con cuánto stock.
   */
  descartarVariantes: z.boolean().optional(),
});

export const varianteSchema = z.object({
  sku: z.string().nullable().optional(),
  /** Precio de lista. Cero es gratis, así que no hay nulo que aceptar. */
  precio: z.number().nonnegative().optional(),
  /** Si se le cobra IVA. El cuánto es del producto. */
  cobraIva: z.boolean().optional(),
  manejaInventario: z.boolean().optional(),
  permiteNegativo: z.boolean().optional(),
  imagenId: z.string().min(1).nullable().optional(),
});

/**
 * Un movimiento de stock.
 *
 * `AJUSTE` e `INGRESO` mandan **cuánto se movió**; `CONTEO` manda **cuánto
 * hay**. Son dos preguntas distintas y mezclarlas obliga a quien cuenta el
 * estante a calcular la diferencia a mano, que es justo lo que la máquina no
 * puede errar.
 */
export const movimientoSchema = z.discriminatedUnion("motivo", [
  z.object({
    motivo: z.literal("CONTEO"),
    contado: z.number().int().min(0),
    nota: z.string().nullable().optional(),
  }),
  z.object({
    motivo: z.enum(["INGRESO", "AJUSTE"]),
    cantidad: z.number().int(),
    nota: z.string().nullable().optional(),
  }),
]);

/** Lo que se pide para subir a la biblioteca. */
export const subirMediaSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z
          .string()
          .min(1)
          .refine((t) => t.startsWith("image/"), "La biblioteca solo lleva imágenes"),
      })
    )
    .min(1)
    .max(10),
});

/** Lo que efectivamente llegó a R2. */
export const confirmarMediaSchema = z.object({
  archivos: z
    .array(
      z.object({
        key: z.string().min(1),
        nombre: z.string().min(1),
        contentType: z.string().min(1),
      })
    )
    .min(1),
});

export const editarMediaSchema = z.object({
  nombre: z.string().min(1).optional(),
  alt: z.string().nullable().optional(),
});

/** Qué imágenes de la biblioteca usa un producto. */
export const agregarImagenesSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1),
});

export const reordenarImagenesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

/**
 * La galería entera: qué fotos y en qué orden.
 *
 * Cada una lleva su `id` de fila cuando ya existe, para que el servidor pueda
 * conservarla —y con ella el vínculo de la variante que la eligió— en vez de
 * borrar y recrear.
 */
export const fijarImagenesSchema = z.object({
  imagenes: z
    .array(
      z.object({
        id: z.string().min(1).nullable().optional(),
        mediaId: z.string().min(1),
      })
    )
    .max(50),
});

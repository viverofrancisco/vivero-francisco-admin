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
  /** Precio de lista. Nulo se acepta: un bien puede cotizarse por trabajo. */
  precio: z.number().nonnegative().nullable().optional(),
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

export const imagenesSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z
          .string()
          .min(1)
          .refine((t) => t.startsWith("image/"), "Un producto solo lleva imágenes"),
      })
    )
    .min(1)
    .max(10),
});

export const confirmarImagenesSchema = z.object({
  imagenes: z
    .array(z.object({ key: z.string().min(1), alt: z.string().nullable().optional() }))
    .min(1),
});

export const reordenarImagenesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

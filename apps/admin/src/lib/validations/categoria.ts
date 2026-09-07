import { z } from "zod/v4";

/** Una categoría del catálogo: cómo se agrupan los productos en el portal. */
export const categoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  orden: z.number().int().min(0).optional(),
  /** De qué se trata. HTML de un editor: el servicio lo sanea. */
  descripcion: z.string().nullable().optional(),
  /** La foto que la representa, de la biblioteca. */
  mediaId: z.string().min(1).nullable().optional(),
});

/**
 * Con qué productos queda la categoría. **La lista entera**, no un alta: vacía
 * es una respuesta válida —una categoría sin nada— y por eso no lleva `min(1)`.
 */
export const agregarProductosSchema = z.object({
  productoIds: z.array(z.string().min(1)),
});

export type CategoriaFormData = z.infer<typeof categoriaSchema>;

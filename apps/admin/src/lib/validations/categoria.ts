import { z } from "zod/v4";

/** Una categoría del catálogo: cómo se agrupan los productos en el portal. */
export const categoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  orden: z.number().int().min(0).optional(),
});

export type CategoriaFormData = z.infer<typeof categoriaSchema>;

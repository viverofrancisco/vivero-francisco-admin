import { z } from "zod/v4";

/**
 * Una categoría del portal. `contificoCategoriaId` es con qué categoría de
 * Contífico se crean sus productos — lo que decide en qué cuenta contable cae
 * la venta — y el nombre viaja con él para poder mostrarlo sin llamar a su API.
 */
export const categoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  orden: z.number().int().min(0).optional(),
  contificoCategoriaId: z.string().min(1).nullable().optional(),
  contificoCategoriaNombre: z.string().min(1).nullable().optional(),
});

export type CategoriaFormData = z.infer<typeof categoriaSchema>;

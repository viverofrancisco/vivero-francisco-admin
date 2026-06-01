import { z } from "zod";

export const tipoServicioSchema = z.enum(["RECURRENTE", "UNICO"]);
export type TipoServicio = z.infer<typeof tipoServicioSchema>;

export const createServicioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoServicioSchema,
});
export type CreateServicioBody = z.infer<typeof createServicioSchema>;

// Edits allow partial updates but require nombre + tipo to remain non-empty
// when present.
export const updateServicioSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoServicioSchema.optional(),
});
export type UpdateServicioBody = z.infer<typeof updateServicioSchema>;

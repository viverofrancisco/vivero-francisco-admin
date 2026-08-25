import { z } from "zod";

/** Qué es el ítem. Es lo único que clasifica un producto del catálogo. */
export const tipoProductoSchema = z.enum(["SERVICIO", "BIEN"]);
export type TipoProducto = z.infer<typeof tipoProductoSchema>;

/**
 * Cada cuánto se cobra una suscripción. Vive en el contrato y no en el
 * catálogo: el mismo producto puede ser mensual para un cliente y trimestral
 * para otro.
 */
export const periodicidadSchema = z.enum([
  "MENSUAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
]);
export type Periodicidad = z.infer<typeof periodicidadSchema>;

export const createServicioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoProductoSchema.default("SERVICIO"),
  /// Porcentaje. En Ecuador conviven 0% y 15%.
  ivaTasa: z.number().min(0).max(100).optional().nullable(),
});
export type CreateServicioBody = z.infer<typeof createServicioSchema>;

// Edits allow partial updates but require nombre to remain non-empty when
// present.
export const updateServicioSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  tipo: tipoProductoSchema.optional(),
  ivaTasa: z.number().min(0).max(100).optional().nullable(),
});
export type UpdateServicioBody = z.infer<typeof updateServicioSchema>;

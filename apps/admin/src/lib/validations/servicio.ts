import { z } from "zod/v4";

/**
 * `tipo` = qué es el ítem, y es lo único que lo clasifica: va a Contífico como
 * SER/PRO. Si se vende suelto o por suscripción no es del producto sino del
 * contrato de cada cliente.
 */
export const servicioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().or(z.literal("")),
  tipo: z.enum(["SERVICIO", "BIEN"]).default("SERVICIO"),
  ivaTasa: z.number().min(0).max(100).nullable().optional(),
  /** Cómo se agrupa en el portal. Opcional: un producto sin categoría se vende igual. */
  categoriaId: z.string().min(1).nullable().optional(),
  /**
   * Vínculo con Contífico, opcional al crear. Un producto sin vincular se
   * guarda igual, pero no se puede vender hasta que lo esté.
   */
  contificoProductoId: z.string().min(1).nullable().optional(),
  codigo: z.string().min(1).nullable().optional(),
  /** Renombrar el producto en Contífico para que coincida con el del portal. */
  actualizarNombre: z.boolean().optional(),
  /** Crearlo en Contífico al guardar, en vez de vincularlo a uno existente. */
  crearEnContifico: z.boolean().optional(),
});

export type ServicioFormData = z.infer<typeof servicioSchema>;

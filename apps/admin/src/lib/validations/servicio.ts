import { z } from "zod/v4";

/**
 * `tipo` = qué es el ítem, y es lo único que lo clasifica. Si se vende suelto o
 * por suscripción no es del producto sino del contrato de cada cliente.
 */
export const servicioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().or(z.literal("")),
  tipo: z.enum(["SERVICIO", "BIEN"]).default("SERVICIO"),
  ivaTasa: z.number().min(0).max(100).nullable().optional(),
  /**
   * En qué categorías está. Varias: un rosal es "Plantas" y "Exterior" a la
   * vez. Opcional — un producto sin ninguna se vende igual.
   */
  categoriaIds: z.array(z.string().min(1)).optional(),
  /**
   * Código del catálogo. Sale impreso como `codigoPrincipal` en cada detalle
   * del XML; sin él se emite con uno derivado del id.
   */
  codigo: z.string().min(1).nullable().optional(),
});

export type ServicioFormData = z.infer<typeof servicioSchema>;

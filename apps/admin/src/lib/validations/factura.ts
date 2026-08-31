import { z } from "zod/v4";

/**
 * Lo que se manda al emitir el documento de una orden.
 *
 * La factura **no tiene por qué tener la forma de la orden**: acá se cobra
 * varios trabajos de un período como una sola línea de "servicio de
 * mantenimiento". Lo que sí tiene que hacer es cuadrar con ella, y de eso se
 * encarga el servicio: es una regla del negocio, no de la forma del cuerpo.
 */
export const lineaFacturaSchema = z.object({
  productoId: z.string().min(1),
  descripcion: z.string().min(1, "La línea necesita una descripción"),
  /**
   * Acompaña al nombre impreso. Viaja como `nombre_manual` y sale en el papel
   * como "Detalle: …" — **no reemplaza el nombre**, que lo pone el producto de
   * Contífico.
   */
  detalle: z.string().nullable().optional(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  ivaTasa: z.number().min(0).max(100),
});

export const emitirFacturaSchema = z.object({
  /** `NO_AUTORIZADO` es el documento sin factura: interno, sin SRI y sin IVA. */
  tipo: z.enum(["FACTURA", "NO_AUTORIZADO"]).optional(),
  datoFacturacionId: z.string().min(1).nullable().optional(),
  /** Lo que sale impreso en *Información Adicional*. */
  descripcion: z.string().nullable().optional(),
  /** Ausente = las líneas de la orden, una a una, como se emitía siempre. */
  lineas: z.array(lineaFacturaSchema).min(1).optional(),
});

export type EmitirFacturaData = z.infer<typeof emitirFacturaSchema>;
export type LineaFacturaData = z.infer<typeof lineaFacturaSchema>;

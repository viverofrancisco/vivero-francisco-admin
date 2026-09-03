import { z } from "zod/v4";

/**
 * Lo que se manda al emitir la factura de una orden.
 *
 * La factura **no tiene por qué tener la forma de la orden**: acá se cobra
 * varios trabajos de un período como una sola línea de "servicio de
 * mantenimiento". Lo que sí tiene que hacer es cuadrar con ella, y de eso se
 * encarga el servicio: es una regla del negocio, no de la forma del cuerpo.
 */
export const lineaFacturaSchema = z.object({
  /** De dónde sale el `codigoPrincipal`, y con qué queda asociada la venta. */
  productoId: z.string().min(1),
  /** Lo que sale impreso, tal cual: va al `descripcion` del detalle del XML. */
  descripcion: z.string().min(1, "La línea necesita una descripción"),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
  ivaTasa: z.number().min(0).max(100),
});

export const emitirFacturaSchema = z.object({
  datoFacturacionId: z.string().min(1).nullable().optional(),
  /** Ausente = las líneas de la orden, una a una. */
  lineas: z.array(lineaFacturaSchema).min(1).optional(),
  /** Con qué emisor se emite. Ausente = el predeterminado. */
  emisorId: z.string().min(1).nullable().optional(),
});

export type EmitirFacturaData = z.infer<typeof emitirFacturaSchema>;
export type LineaFacturaData = z.infer<typeof lineaFacturaSchema>;

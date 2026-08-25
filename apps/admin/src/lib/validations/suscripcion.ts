import { z } from "zod/v4";

/** Un producto recurrente dentro de la suscripción, con su precio propio. */
export const suscripcionItemSchema = z.object({
  productoId: z.string().min(1, "Elegí un producto"),
  precio: z.number().min(0, "El precio no puede ser negativo"),
  /// Porcentaje. En Ecuador conviven 0% y 15%.
  ivaTasa: z.number().min(0).max(100).nullable().optional(),
  /// Visitas incluidas por período de cobro. Informativo: no limita agendar.
  visitasPorPeriodo: z
    .number()
    .int()
    .min(1, "Mínimo 1 visita por período")
    .nullable()
    .optional(),
});

export const periodicidadSchema = z.enum([
  "MENSUAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
]);

export const estadoSuscripcionSchema = z.enum([
  "ACTIVO",
  "PAUSADO",
  "CANCELADO",
]);

export const crearSuscripcionSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  periodicidad: periodicidadSchema.default("MENSUAL"),
  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  notas: z.string().max(1000).nullable().optional(),
  items: z.array(suscripcionItemSchema).min(1, "Agregá al menos un producto"),
});

/**
 * Acá no se cambia el cliente: una suscripción de otro cliente sería otra
 * suscripción.
 */
export const actualizarSuscripcionSchema = z.object({
  periodicidad: periodicidadSchema.optional(),
  estado: estadoSuscripcionSchema.optional(),
  fechaInicio: z.string().min(1).optional(),
  notas: z.string().max(1000).nullable().optional(),
  items: z.array(suscripcionItemSchema).min(1).optional(),
});

export const suscripcionesQuerySchema = z.object({
  clienteId: z.string().optional(),
  estado: estadoSuscripcionSchema.optional(),
  incluirCanceladas: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

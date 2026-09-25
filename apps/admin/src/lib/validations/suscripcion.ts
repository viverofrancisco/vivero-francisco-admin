import { z } from "zod/v4";
import { estadoSuscripcionSchema } from "@vivero/shared";

/**
 * Los esquemas del plan viven en `@vivero/shared`: el portal y la app crean y
 * editan la misma suscripción, así que las reglas se escriben una vez.
 */
export {
  crearSuscripcionSchema,
  actualizarSuscripcionSchema,
  periodicidadSchema,
  estadoSuscripcionSchema,
} from "@vivero/shared";

export const suscripcionesQuerySchema = z.object({
  clienteId: z.string().optional(),
  estado: z.enum(estadoSuscripcionSchema.options).optional(),
  incluirCanceladas: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

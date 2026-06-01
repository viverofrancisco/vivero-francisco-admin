import { z } from "zod";

export const estadoClienteServicioSchema = z.enum([
  "ACTIVO",
  "PAUSADO",
  "CANCELADO",
]);
export type EstadoClienteServicio = z.infer<typeof estadoClienteServicioSchema>;

export const asignarServicioSchema = z.object({
  servicioId: z.string().min(1, "Selecciona un servicio"),
  precio: z.number().nonnegative("El precio no puede ser negativo"),
  iva: z.number().nonnegative().optional(),
  frecuenciaMensual: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  notas: z.string().trim().max(1000).optional().nullable(),
});
export type AsignarServicioBody = z.infer<typeof asignarServicioSchema>;

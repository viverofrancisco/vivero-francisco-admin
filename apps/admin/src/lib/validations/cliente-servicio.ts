import { z } from "zod/v4";

export const clienteServicioSchema = z.object({
  servicioId: z.string().min(1, "Selecciona un servicio"),
  precio: z.number().positive("El precio debe ser mayor a 0"),
  iva: z.number().min(0, "El IVA no puede ser negativo").default(0),
  frecuenciaMensual: z.number().int().min(1, "Mínimo 1 vez al mes").optional(),
  estado: z.enum(["ACTIVO", "PAUSADO", "CANCELADO"]).default("ACTIVO"),
  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  fechaFin: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

export type ClienteServicioFormData = z.infer<typeof clienteServicioSchema>;

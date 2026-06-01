import { z } from "zod/v4";

export const servicioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().or(z.literal("")),
  tipo: z.enum(["RECURRENTE", "UNICO"]),
});

export type ServicioFormData = z.infer<typeof servicioSchema>;

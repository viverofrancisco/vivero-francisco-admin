import { z } from "zod/v4";

export const grupoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().or(z.literal("")),
  miembrosIds: z.array(z.string()).default([]),
});

export type GrupoFormData = z.infer<typeof grupoSchema>;

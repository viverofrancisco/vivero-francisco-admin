import { z } from "zod/v4";

const telefonoEcuadorRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

export const jardineroSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  telefono: z.string().regex(telefonoEcuadorRegex, "Número inválido. Ej: 0991234567 o +593991234567").optional().or(z.literal("")),
  email: z.email("Email inválido").optional().or(z.literal("")),
  especialidad: z.string().optional().or(z.literal("")),
  disponible: z.boolean().default(true),
});

export type JardineroFormData = z.infer<typeof jardineroSchema>;

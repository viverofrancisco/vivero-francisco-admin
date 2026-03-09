import { z } from "zod/v4";

// Teléfono ecuatoriano: celular (09XXXXXXXX o +5939XXXXXXXX) o fijo (02XXXXXXX, 04XXXXXXX, etc.)
const telefonoEcuadorRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  email: z.email("Email inválido").optional().or(z.literal("")),
  telefono: z
    .string()
    .regex(telefonoEcuadorRegex, "Número inválido. Ej: 0991234567 o +593991234567")
    .optional()
    .or(z.literal("")),
  ciudad: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  numeroCasa: z.string().optional().or(z.literal("")),
  referencia: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

export type ClienteFormData = z.infer<typeof clienteSchema>;

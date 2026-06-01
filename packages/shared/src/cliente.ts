import { z } from "zod";

// Same regex as admin's web validation (Ecuador: celular 09XXXXXXXX or
// +5939XXXXXXXX, or fijo 02-07XXXXXXXX).
const telefonoRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v ?? null));

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  apellido: optionalString,
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  telefono: z
    .string()
    .trim()
    .regex(telefonoRegex, "Número inválido. Ej: 0991234567 o +593991234567")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  ciudad: optionalString,
  sectorId: z
    .string()
    .min(1)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  direccion: optionalString,
  numeroCasa: optionalString,
  referencia: optionalString,
  notas: optionalString,
  metrosCuadrados: z
    .number()
    .positive("Debe ser mayor a 0")
    .optional()
    .nullable(),
});
export type CreateClienteBody = z.infer<typeof createClienteSchema>;

// Update is the same shape — all optional. Reuse the same schema; partial
// inputs only update what they include.
export const updateClienteSchema = createClienteSchema.partial();
export type UpdateClienteBody = z.infer<typeof updateClienteSchema>;

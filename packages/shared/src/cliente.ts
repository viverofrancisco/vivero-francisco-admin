import { z } from "zod";

// Same regex as admin's web validation. Acepta teléfono ecuatoriano (celular
// 09XXXXXXXX o +5939XXXXXXXX, o fijo 0[2-7]XXXXXXX) o internacional en formato
// E.164 (+<código de país> con 7-15 dígitos en total).
const telefonoRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$|^\+[1-9]\d{6,14}$/;

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v ?? null));

const clienteBaseSchema = z.object({
  nombre: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null)),
  apellido: optionalString,
  empresa: optionalString,
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
    .regex(telefonoRegex, "Número inválido. Ej: 0991234567, +593991234567 o +<país> internacional")
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
// Un cliente puede ser una persona (nombre) o una empresa (empresa). Se exige
// al menos uno de los dos al crear.
export const createClienteSchema = clienteBaseSchema.refine(
  (d) => Boolean(d.nombre?.trim() || d.empresa?.trim()),
  { message: "Se requiere un nombre o una empresa", path: ["nombre"] }
);
export type CreateClienteBody = z.infer<typeof createClienteSchema>;

// Update is the same shape — all optional. No se re-valida nombre/empresa: la
// actualización es parcial y el registro existente ya cumple la regla.
export const updateClienteSchema = clienteBaseSchema.partial();
export type UpdateClienteBody = z.infer<typeof updateClienteSchema>;

// ──────────────────────────────────────────────
// Nombre para mostrar (persona o empresa)
// ──────────────────────────────────────────────

export interface ClienteNombre {
  nombre?: string | null;
  apellido?: string | null;
  empresa?: string | null;
}

/** "Nombre Apellido" — vacío si el cliente no tiene nombre de persona. */
export function nombrePersona(c: ClienteNombre): string {
  return `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim();
}

/** Mejor etiqueta para mostrar: la persona si existe; si no, la empresa. */
export function nombreCliente(c: ClienteNombre): string {
  return nombrePersona(c) || (c.empresa ?? "").trim() || "Sin nombre";
}

import { z } from "zod/v4";

// Teléfono ecuatoriano: celular (09XXXXXXXX o +5939XXXXXXXX) o fijo (02XXXXXXX, 04XXXXXXX, etc.)
const telefonoEcuadorRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().optional().or(z.literal("")),
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
  metrosCuadrados: z.union([
    z.coerce.number().positive("Debe ser mayor a 0"),
    z.literal("").transform(() => undefined),
  ]).optional(),
});

export type ClienteFormData = z.infer<typeof clienteSchema>;

// ──────────────────────────────────────────────
// Importación CSV (una fila)
// ──────────────────────────────────────────────

// Las celdas del CSV llegan como strings (o undefined si falta la columna).
// Normalizamos toda la fila primero (trim; "" o ausente → undefined) y luego
// validamos con campos `.optional()`. Esto evita el manejo de undefined por
// campo en zod v4.
const csvText = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
};

export const clienteImportRowSchema = z.preprocess(
  (raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      nombre: typeof r.nombre === "string" ? r.nombre.trim() : "",
      apellido: csvText(r.apellido),
      email: csvText(r.email),
      telefono: csvText(r.telefono),
      ciudad: csvText(r.ciudad),
      direccion: csvText(r.direccion),
      numeroCasa: csvText(r.numeroCasa),
      referencia: csvText(r.referencia),
      notas: csvText(r.notas),
      metrosCuadrados: csvText(r.metrosCuadrados),
    };
  },
  z
    .object({
      nombre: z.string().min(1, "El nombre es obligatorio").max(120),
      apellido: z.string().max(500).optional(),
      email: z.email("Email inválido").optional(),
      telefono: z
        .string()
        .regex(telefonoEcuadorRegex, "Número inválido. Ej: 0991234567 o +593991234567")
        .optional(),
      ciudad: z.string().max(500).optional(),
      direccion: z.string().max(500).optional(),
      numeroCasa: z.string().max(500).optional(),
      referencia: z.string().max(500).optional(),
      notas: z.string().max(500).optional(),
      metrosCuadrados: z.coerce.number().positive("Debe ser mayor a 0").optional(),
    })
    .refine((r) => Boolean(r.email || r.telefono), {
      message: "Se requiere teléfono o correo",
      path: ["telefono"],
    })
);

export type ClienteImportRow = z.infer<typeof clienteImportRowSchema>;

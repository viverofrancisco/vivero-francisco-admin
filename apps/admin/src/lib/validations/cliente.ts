import { z } from "zod/v4";

// Teléfono: ecuatoriano (celular 09XXXXXXXX o +5939XXXXXXXX, o fijo 0[2-7]XXXXXXX)
// o internacional en formato E.164 (+<código de país> con 7-15 dígitos en total).
const telefonoRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$|^\+[1-9]\d{6,14}$/;

const clienteBase = z.object({
  nombre: z.string().optional().or(z.literal("")),
  apellido: z.string().optional().or(z.literal("")),
  empresa: z.string().optional().or(z.literal("")),
  email: z.email("Email inválido").optional().or(z.literal("")),
  telefono: z
    .string()
    .regex(telefonoRegex, "Número inválido. Ej: 0991234567, +593991234567 o +<país> internacional")
    .optional()
    .or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

// Un cliente es una persona (nombre) o una empresa (empresa): se exige uno.
const tieneNombre = {
  check: (d: { nombre?: string; empresa?: string }) =>
    Boolean(d.nombre?.trim() || d.empresa?.trim()),
  message: "Se requiere un nombre o una empresa",
  path: ["nombre"] as const,
};

export const clienteSchema = clienteBase.refine(tieneNombre.check, {
  message: tieneNombre.message,
  path: [...tieneNombre.path],
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
      empresa: csvText(r.empresa),
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
      nombre: z.string().max(120).optional(),
      apellido: z.string().max(500).optional(),
      empresa: z.string().max(500).optional(),
      email: z.email("Email inválido").optional(),
      telefono: z
        .string()
        .regex(telefonoRegex, "Número inválido. Ej: 0991234567, +593991234567 o +<país> internacional")
        .optional(),
      ciudad: z.string().max(500).optional(),
      direccion: z.string().max(500).optional(),
      numeroCasa: z.string().max(500).optional(),
      referencia: z.string().max(500).optional(),
      notas: z.string().max(500).optional(),
      metrosCuadrados: z.coerce.number().positive("Debe ser mayor a 0").optional(),
    })
    // Se exige nombre o empresa (igual que al crear un cliente en el dashboard).
    // Teléfono y correo siguen siendo opcionales.
    .refine((d) => Boolean(d.nombre?.trim() || d.empresa?.trim()), {
      message: "Se requiere un nombre o una empresa",
      path: ["nombre"],
    })
);

export type ClienteImportRow = z.infer<typeof clienteImportRowSchema>;

// ──────────────────────────────────────────────
// Propiedades
// ──────────────────────────────────────────────

/** Un número que puede venir vacío del formulario. */
const numeroDeFormulario = (mensaje = "No puede ser negativo") =>
  z
    .union([
      z.coerce.number().min(0, mensaje),
      z.literal("").transform(() => undefined),
    ])
    .optional();

/**
 * Un lugar donde se trabaja.
 *
 * La dirección era del cliente y se mudó acá, junto con el sector: un cliente
 * con dos casas tiene dos direcciones y ninguna de las dos es "la suya", y el
 * sector es geográfico, así que es del lugar y no de la persona.
 *
 * Los números de abajo son lo que hay que mantener, que es con lo que se
 * cotiza, y todos son opcionales: se completan a medida que alguien los mide.
 */
export const propiedadSchema = z.object({
  nombre: z.string().min(1, "Ponle un nombre"),
  ciudad: z.string().optional().or(z.literal("")),
  sectorId: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  numeroCasa: z.string().optional().or(z.literal("")),
  referencia: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  /** El punto del mapa. Van los dos o no va ninguno. */
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  m2Total: numeroDeFormulario(),
  jardinerasPlantaAlta: z.boolean().optional(),
  numeroArboles: numeroDeFormulario(),
  mlVegetacionBaja: numeroDeFormulario(),
  mlVegetacionMedia: numeroDeFormulario(),
  mlVegetacionAlta: numeroDeFormulario(),
  m2Cesped: numeroDeFormulario(),
});

export type PropiedadFormData = z.infer<typeof propiedadSchema>;

/**
 * Crear un cliente es crear también su primera propiedad.
 *
 * Un cliente sin ningún lugar donde trabajar no sirve para agendar, y cargarlo
 * en dos pasos es garantizar que alguien se olvide del segundo — lo mismo que
 * pasaba con la cuenta del jardinero antes de que naciera con su ficha.
 */
export const clienteConPropiedadSchema = clienteBase
  .extend({ propiedad: propiedadSchema.partial().optional() })
  .refine(tieneNombre.check, {
    message: tieneNombre.message,
    path: [...tieneNombre.path],
  });

export type ClienteConPropiedadFormData = z.infer<
  typeof clienteConPropiedadSchema
>;

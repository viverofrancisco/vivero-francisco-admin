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
  notas: optionalString,
});

/**
 * Un lugar donde se trabaja.
 *
 * La dirección era del cliente y se mudó acá: un cliente con dos casas tiene
 * dos direcciones y ninguna de las dos es "la suya". El sector vino con ella
 * porque es geográfico —es del lugar, no de la persona—.
 *
 * Los números son **lo que hay que mantener**, que es con lo que se cotiza, y
 * todos son opcionales: se completan a medida que alguien los mide, y una
 * propiedad recién cargada sirve igual para agendar.
 */
const numeroOpcional = (mensaje = "No puede ser negativo") =>
  z.number().min(0, mensaje).optional().nullable();

export const propiedadBaseSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre").max(120),
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
  /** El punto exacto, elegido en el mapa. Van juntos o no van. */
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  m2Total: numeroOpcional(),
  jardinerasPlantaAlta: z.boolean().optional(),
  numeroArboles: z.number().int().min(0).optional().nullable(),
  mlVegetacionBaja: numeroOpcional(),
  mlVegetacionMedia: numeroOpcional(),
  mlVegetacionAlta: numeroOpcional(),
  m2Cesped: numeroOpcional(),
});

export const createPropiedadSchema = propiedadBaseSchema.refine(
  (d) => (d.lat === null || d.lat === undefined) === (d.lng === null || d.lng === undefined),
  { message: "El punto del mapa necesita las dos coordenadas", path: ["lat"] }
);
export type CreatePropiedadBody = z.infer<typeof createPropiedadSchema>;

export const updatePropiedadSchema = propiedadBaseSchema.partial();
export type UpdatePropiedadBody = z.infer<typeof updatePropiedadSchema>;
// Un cliente puede ser una persona (nombre) o una empresa (empresa). Se exige
// al menos uno de los dos al crear.
export const createClienteSchema = clienteBaseSchema
  .extend({
    /**
     * La primera propiedad, en el mismo formulario.
     *
     * Un cliente sin ningún lugar donde trabajar no sirve para agendar, y
     * obligar a cargarlo en dos pasos es garantizar que alguien se olvide del
     * segundo. Opcional en el tipo porque el formulario del teléfono todavía
     * puede mandar solo el contacto; el servicio le pone una "Principal" vacía.
     */
    propiedad: propiedadBaseSchema.partial().optional(),
  })
  .refine((d) => Boolean(d.nombre?.trim() || d.empresa?.trim()), {
    message: "Se requiere un nombre o una empresa",
    path: ["nombre"],
  });
export type CreateClienteBody = z.infer<typeof createClienteSchema>;

// Update is the same shape — all optional. No se re-valida nombre/empresa: la
// actualización es parcial y el registro existente ya cumple la regla.
export const updateClienteSchema = clienteBaseSchema.partial();
export type UpdateClienteBody = z.infer<typeof updateClienteSchema>;

/** Marcar un cliente como inactivo, o reactivarlo. */
export const clienteInactivoSchema = z.object({ inactivo: z.boolean() });
export type ClienteInactivoBody = z.infer<typeof clienteInactivoSchema>;

/** Lo mismo, de a varios: desde la selección de la lista. */
export const clientesInactivoEnLoteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  inactivo: z.boolean(),
});

/** El filtro de la lista: todos, solo activos o solo inactivos. */
export const ESTADOS_DE_CLIENTE = ["activos", "inactivos"] as const;
export type EstadoDeCliente = (typeof ESTADOS_DE_CLIENTE)[number];

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

/**
 * El renglón de abajo de un cliente en una lista.
 *
 * La empresa va primero **cuando el nombre de arriba es el de la persona** —es
 * el dato que la fila de arriba no dice—, y después el sector y el teléfono,
 * que es con lo que se lo ubica. El sector sale de su primera propiedad: con
 * varias, nombrar una sola sería mentira la mitad del tiempo, y la fila tiene
 * lugar para una línea.
 *
 * Vive en compartido porque la misma fila se dibuja en el portal y en la app, y
 * con la regla escrita dos veces cada lista terminaba diciendo otra cosa.
 */
export function resumenDeCliente(c: {
  nombre?: string | null;
  apellido?: string | null;
  empresa?: string | null;
  telefono?: string | null;
  propiedades?: { sector?: { nombre: string } | null }[] | null;
}): string {
  const partes = [
    nombrePersona(c) && c.empresa ? c.empresa : null,
    c.propiedades?.[0]?.sector?.nombre ?? null,
    c.telefono ?? null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin datos de contacto";
}

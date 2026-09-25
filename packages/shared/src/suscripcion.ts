import { z } from "zod";
import { periodicidadSchema } from "./servicio";

/**
 * Un plan es un precio por un jardín: de qué propiedad del cliente es, cuánto
 * se cobra por período y cuántas visitas incluye. Sin productos — lo que se
 * pacta con el cliente es un número por mantenerle el jardín, no una lista del
 * catálogo.
 *
 * Viven acá porque el portal y la app crean y editan el mismo plan, y dos
 * esquemas para una cosa son dos reglas hasta que alguien las compara.
 */
/** Los ciclos, en el orden en que se ofrecen. `periodicidadSchema` vive en `servicio.ts`. */
export const PERIODICIDADES = periodicidadSchema.options;

export const ESTADOS_DE_SUSCRIPCION = ["ACTIVO", "PAUSADO", "CANCELADO"] as const;
export type EstadoDeSuscripcion = (typeof ESTADOS_DE_SUSCRIPCION)[number];

export const estadoSuscripcionSchema = z.enum(ESTADOS_DE_SUSCRIPCION);

export const crearSuscripcionSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  propiedadId: z.string().min(1, "Elige de qué propiedad es el plan"),
  periodicidad: periodicidadSchema.default("MENSUAL"),
  fechaInicio: z.string().min(1, "La fecha de inicio es obligatoria"),
  /** Sin IVA, por período completo. */
  precio: z.number().min(0, "El precio no puede ser negativo"),
  /** Porcentaje. En Ecuador conviven 0% y 15%. */
  ivaTasa: z.number().min(0).max(100).nullable().optional(),
  /** Visitas incluidas por período de cobro. Informativo: no limita agendar. */
  visitasPorPeriodo: z
    .number()
    .int()
    .min(1, "Mínimo 1 visita por período"),
  notas: z.string().max(1000).nullable().optional(),
});
export type CrearSuscripcionBody = z.infer<typeof crearSuscripcionSchema>;

/**
 * Acá no se cambia el cliente: una suscripción de otro cliente sería otra
 * suscripción. La propiedad sí, siempre que sea del mismo cliente: se cargó
 * contra la casa y era la oficina.
 */
export const actualizarSuscripcionSchema = z.object({
  propiedadId: z.string().min(1).optional(),
  periodicidad: periodicidadSchema.optional(),
  estado: estadoSuscripcionSchema.optional(),
  fechaInicio: z.string().min(1).optional(),
  precio: z.number().min(0, "El precio no puede ser negativo").optional(),
  ivaTasa: z.number().min(0).max(100).nullable().optional(),
  visitasPorPeriodo: z
    .number()
    .int()
    .min(1, "Mínimo 1 visita por período")
    .optional(),
  notas: z.string().max(1000).nullable().optional(),
});
export type ActualizarSuscripcionBody = z.infer<typeof actualizarSuscripcionSchema>;

/** Cómo se dice la periodicidad en pantalla. */
export const PERIODICIDAD_LABEL: Record<string, string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

const PERIODICIDAD_UNIDAD: Record<string, string> = {
  MENSUAL: "mes",
  TRIMESTRAL: "trimestre",
  SEMESTRAL: "semestre",
  ANUAL: "año",
};

/** "mes", "trimestre": la unidad del período, para "4 visitas/mes". */
export function unidadDePeriodo(periodicidad: string): string {
  return PERIODICIDAD_UNIDAD[periodicidad] ?? "período";
}

/** Cómo se dice el estado de un plan en pantalla. */
export const ESTADO_SUSCRIPCION_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  CANCELADO: "Cancelado",
};

/** Lo que el cliente paga por período: la base con su IVA. */
export function totalDelPeriodo(precio: number, ivaTasa: number): number {
  return Math.round(precio * (1 + ivaTasa / 100) * 100) / 100;
}

/**
 * "Casa · Mensual · 4 visitas/mes": lo que distingue un plan de otro en un
 * selector, en el portal y en la app.
 */
export function describirPlan(plan: {
  periodicidad: string;
  visitasPorPeriodo: number;
  propiedad: { nombre: string };
}): string {
  return `${plan.propiedad.nombre} · ${PERIODICIDAD_LABEL[plan.periodicidad] ?? plan.periodicidad} · ${plan.visitasPorPeriodo} visita${plan.visitasPorPeriodo === 1 ? "" : "s"}/${unidadDePeriodo(plan.periodicidad)}`;
}

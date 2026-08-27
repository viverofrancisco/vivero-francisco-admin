import { z } from "zod/v4";

/** Un producto de la visita. Sin plata: eso se decide al facturar. */
export const productoDeVisitaSchema = z.object({
  productoId: z.string().min(1),
});

export const crearVisitasSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  productos: z
    .array(productoDeVisitaSchema)
    .min(1, "Selecciona al menos un producto"),
  fechas: z.array(z.string().min(1)).min(1, "Selecciona al menos una fecha"),
  grupoId: z.string().optional().or(z.literal("")),
  /// De qué plan es la visita. Vacío = trabajo aparte, se cobra en una orden.
  suscripcionId: z.string().nullable().optional().or(z.literal("")),
  personalIds: z.array(z.string()).default([]),
  notas: z.string().optional().or(z.literal("")),
});

/**
 * PUT /api/visitas/[id] — edición general de una visita ya creada, en cualquier
 * estado. Si viene `productoIds`, reemplaza el conjunto de productos.
 */
export const actualizarVisitaSchema = z.object({
  fechaProgramada: z.string().min(1).optional(),
  /// Cadena vacía = borrarla. Una visita que se reabre deja de tener fecha real.
  fechaRealizada: z.string().nullable().optional(),
  /// "HH:MM". Vacío las borra; las carga el cierre y se corrigen en la edición.
  horaEntrada: z.string().nullable().optional(),
  horaSalida: z.string().nullable().optional(),
  productoIds: z.array(z.string().min(1)).min(1).optional(),
  productos: z.array(productoDeVisitaSchema).min(1).optional(),
  grupoId: z.string().nullable().optional(),
  /// `null` la desvincula del plan: todo su trabajo pasa a cobrarse aparte.
  suscripcionId: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  /// Va en el mismo PUT que el resto: la pantalla de edición guarda todo junto.
  personalIds: z.array(z.string()).optional(),
});

export type ActualizarVisitaFormData = z.infer<typeof actualizarVisitaSchema>;
export type CrearVisitasFormData = z.infer<typeof crearVisitasSchema>;


export const completarVisitaSchema = z.object({
  estado: z.enum(["COMPLETADA", "INCOMPLETA", "CANCELADA"]),
  fechaRealizada: z.string().min(1, "La fecha realizada es obligatoria"),
  horaEntrada: z.string().optional().or(z.literal("")),
  horaSalida: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  notasIncompleto: z.string().optional().or(z.literal("")),
  /**
   * Quién fue de verdad. Se manda desde la pantalla de cerrar la visita porque
   * es ahí donde se sabe: lo que se asignó al agendar es una intención, y el
   * que faltó ese día no tiene por qué quedar figurando.
   *
   * Ausente = no se toca. Vacío = nadie fue.
   */
  personalIds: z.array(z.string()).optional(),
});

export type CompletarVisitaFormData = z.infer<typeof completarVisitaSchema>;

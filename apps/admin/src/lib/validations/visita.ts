import { z } from "zod/v4";

/**
 * Agendar. **Sin productos**: lo que se hace en una visita son tareas, y las
 * carga cada jardinero al terminar. Acá solo se puede exigir alguna.
 */
export const crearVisitasSchema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  fechas: z.array(z.string().min(1)).min(1, "Selecciona al menos una fecha"),
  /// Lo que esta visita exige que se haga. Opcional: la mayoría no exige nada.
  tareasObligatoriasIds: z.array(z.string().min(1)).default([]),
  grupoId: z.string().optional().or(z.literal("")),
  /// De qué plan es la visita. Vacío = trabajo aparte.
  suscripcionId: z.string().nullable().optional().or(z.literal("")),
  personalIds: z.array(z.string()).default([]),
  notas: z.string().optional().or(z.literal("")),
});

/**
 * PUT /api/visitas/[id] — edición general, en cualquier estado.
 *
 * Las horas no están: salen de los partes de cada uno (la primera entrada y la
 * última salida), así que ponerlas a mano acá las pisaría hasta el próximo
 * parte. Corregir una hora es corregir el parte de quien la cargó.
 */
export const actualizarVisitaSchema = z.object({
  fechaProgramada: z.string().min(1).optional(),
  /// Cadena vacía = borrarla. Una visita que se reabre deja de tener fecha real.
  fechaRealizada: z.string().nullable().optional(),
  /// Reemplaza el juego entero de obligatorias.
  tareasObligatoriasIds: z.array(z.string().min(1)).optional(),
  grupoId: z.string().nullable().optional(),
  /// `null` la desvincula del plan.
  suscripcionId: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  /// Va en el mismo PUT que el resto: la pantalla de edición guarda todo junto.
  personalIds: z.array(z.string()).optional(),
});

/**
 * POST /api/visitas/eliminar — eliminar varias de una vez.
 *
 * Con tope: la pantalla manda lo que esté seleccionado, y cada visita revisa
 * sus órdenes por su cuenta, así que un pedido de miles de ids sería una
 * request que no termina.
 */
export const eliminarVisitasSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export type ActualizarVisitaFormData = z.infer<typeof actualizarVisitaSchema>;
export type CrearVisitasFormData = z.infer<typeof crearVisitasSchema>;


/**
 * Cerrar la visita, desde el portal. **Solo ADMIN/STAFF.**
 *
 * Ya no lleva horas: las cargó cada uno con su parte. Lo que se decide acá es
 * si el trabajo está terminado, con qué fecha se da por hecho, y —si quedó a
 * medias— por qué.
 */
export const completarVisitaSchema = z.object({
  estado: z.enum(["COMPLETADA", "INCOMPLETA", "CANCELADA"]),
  fechaRealizada: z.string().min(1, "La fecha realizada es obligatoria"),
  notas: z.string().optional().or(z.literal("")),
  notasIncompleto: z.string().optional().or(z.literal("")),
  /**
   * Quién fue de verdad. Se manda desde la pantalla de cerrar porque es ahí
   * donde se sabe: lo que se asignó al agendar es una intención, y el que faltó
   * ese día no tiene por qué quedar figurando.
   *
   * Ausente = no se toca. Vacío = nadie fue.
   */
  personalIds: z.array(z.string()).optional(),
});

export type CompletarVisitaFormData = z.infer<typeof completarVisitaSchema>;

/**
 * El parte de una persona, desde el portal. Espejo de `parteVisitaSchema` de
 * `@vivero/shared`, que es el que usa la app móvil.
 */
export const parteVisitaSchema = z.object({
  personalId: z.string().min(1).optional(),
  /**
   * Corrección de los instantes marcados, en ISO.
   *
   * Eran `"HH:MM"`. Ahora la entrada y la salida se marcan con un botón que
   * sella el momento, y esto es lo que la oficina manda cuando hay que
   * arreglar uno — una corrección de un instante, no una hora suelta.
   */
  entradaEl: z.string().datetime().nullable().optional(),
  salidaEl: z.string().datetime().nullable().optional(),
  tareaIds: z.array(z.string().min(1)),
});

export type ParteVisitaFormData = z.infer<typeof parteVisitaSchema>;

import { z } from "zod/v4";

export const visitaSchema = z.object({
  clienteServicioId: z.string().min(1, "Selecciona un servicio asignado"),
  fechaProgramada: z.string().min(1, "La fecha programada es obligatoria"),
  grupoId: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

export type VisitaFormData = z.infer<typeof visitaSchema>;

export const crearVisitasSchema = z.object({
  clienteServicioId: z.string().min(1, "Selecciona un servicio asignado"),
  fechas: z.array(z.string().min(1)).min(1, "Selecciona al menos una fecha"),
  grupoId: z.string().optional().or(z.literal("")),
  personalIds: z.array(z.string()).default([]),
  notas: z.string().optional().or(z.literal("")),
});

export type CrearVisitasFormData = z.infer<typeof crearVisitasSchema>;

export const completarVisitaSchema = z.object({
  estado: z.enum(["COMPLETADA", "INCOMPLETA", "CANCELADA"]),
  fechaRealizada: z.string().min(1, "La fecha realizada es obligatoria"),
  horaEntrada: z.string().optional().or(z.literal("")),
  horaSalida: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  notasIncompleto: z.string().optional().or(z.literal("")),
});

export type CompletarVisitaFormData = z.infer<typeof completarVisitaSchema>;

import { z } from "zod/v4";

export const visitaSchema = z.object({
  clienteServicioId: z.string().min(1, "Selecciona un servicio asignado"),
  fechaProgramada: z.string().min(1, "La fecha programada es obligatoria"),
  grupoId: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

export type VisitaFormData = z.infer<typeof visitaSchema>;

export const completarVisitaSchema = z.object({
  estado: z.enum(["COMPLETADA", "INCOMPLETA"]),
  fechaRealizada: z.string().min(1, "La fecha realizada es obligatoria"),
  notas: z.string().optional().or(z.literal("")),
  notasIncompleto: z.string().optional().or(z.literal("")),
  nuevaFechaProgramada: z.string().optional().or(z.literal("")),
});

export type CompletarVisitaFormData = z.infer<typeof completarVisitaSchema>;

export const reagendarVisitaSchema = z.object({
  nuevaFecha: z.string().min(1, "La nueva fecha es obligatoria"),
  notas: z.string().optional().or(z.literal("")),
});

export type ReagendarVisitaFormData = z.infer<typeof reagendarVisitaSchema>;

export const generarVisitasSchema = z.object({
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2024).max(2100),
});

export type GenerarVisitasFormData = z.infer<typeof generarVisitasSchema>;

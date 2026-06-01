import { z } from "zod/v4";

export const notificacionConfigSchema = z.object({
  whatsappActivo: z.boolean().optional(),
  horaEnvioRecordatorio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  horaEnvioDigesto: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  diasAnticipacion: z.coerce.number().int().min(1).max(7).optional(),
  autoRespuestaActiva: z.boolean().optional(),
  autoRespuestaContenido: z.string().optional().or(z.literal("")),
  forwardActivo: z.boolean().optional(),
  forwardTelefono: z.string().optional().or(z.literal("")),
});

export type NotificacionConfigFormData = z.infer<typeof notificacionConfigSchema>;

export const plantillaUpdateSchema = z.object({
  activa: z.boolean().optional(),
  whatsappTemplateName: z.string().optional().or(z.literal("")),
  contenido: z.string().min(1, "El contenido es obligatorio").optional(),
  target: z.enum(["contenido", "contenidoEnRevision"]).optional(),
});

export type PlantillaUpdateFormData = z.infer<typeof plantillaUpdateSchema>;

export const testWhatsappSchema = z.object({
  telefono: z.string().min(1, "El teléfono es obligatorio"),
  mensaje: z.string().min(1, "El mensaje es obligatorio"),
});

export type TestWhatsappFormData = z.infer<typeof testWhatsappSchema>;

export const enviarManualSchema = z.object({
  tipo: z.enum([
    "RECORDATORIO_VISITA_CLIENTE",
    "CONFIRMACION_VISITA_CLIENTE",
    "RESUMEN_DIARIO_ADMIN",
    "ALERTA_VISITA_COMPLETADA",
    "ALERTA_VISITA_INCOMPLETA",
    "MENSAJE_ENTRANTE_CLIENTE",
  ]),
  visitaId: z.string().optional(),
});

export type EnviarManualFormData = z.infer<typeof enviarManualSchema>;

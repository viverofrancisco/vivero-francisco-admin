import { z } from "zod/v4";

export const grupoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  descripcion: z.string().optional().or(z.literal("")),
  miembrosIds: z.array(z.string()).default([]),
});

export type GrupoFormData = z.infer<typeof grupoSchema>;

/**
 * Los ids de un borrado en lote. El tope no es decorativo: cada ficha se
 * archiva sola, así que mil ids son mil idas a la base en una sola petición.
 */
export const eliminarEnLoteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

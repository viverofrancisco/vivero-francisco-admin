import { z } from "zod/v4";

/**
 * Una tarea del catálogo: nombre y, si hace falta, en qué consiste.
 *
 * Sin precio, sin IVA y sin stock: una tarea es lo que se **hace** en una
 * visita, no lo que se vende. La descripción no es decorativa — es lo que el
 * asistente de informes usa para escribir la sección de esa tarea.
 *
 * Estaba escrita adentro de la ruta web; la sacamos acá cuando la app también
 * empezó a crear tareas, para no tener dos definiciones de lo mismo.
 */
export const tareaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(200),
  descripcion: z.string().max(2000).nullable().optional(),
});

export type TareaFormData = z.infer<typeof tareaSchema>;

import { z } from "zod/v4";

const telefonoEcuadorRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

/**
 * Un campo de texto que puede venir vacío: `""` del portal, `null` de la app
 * —que manda lo que la ficha le devolvió— o directamente ausente. Los tres
 * significan lo mismo y salen como `""`, que es lo que el servicio ya
 * entendía. Sin el `null`, crear a alguien desde la app fallaba con
 * "Invalid input" por un apellido o un teléfono en blanco.
 */
const textoOpcional = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? "");

export const personalSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: textoOpcional,
  telefono: z
    .union([
      z.string().regex(telefonoEcuadorRegex, "Número inválido. Ej: 0991234567 o +593991234567"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => v ?? ""),
  especialidad: textoOpcional,
  sueldo: z.union([
    z.coerce.number().positive("Debe ser mayor a 0"),
    z.literal("").transform(() => undefined),
  ]).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
  tipo: z
    .union([z.enum(["JARDINERO", "CHOFER", "SUPERVISOR", "MECANICO"]), z.literal(""), z.null()])
    .optional()
    .transform((v) => v ?? ""),
  // Con qué entra a la app. Vive en `User`, no en `Personal`, pero se edita acá
  // porque es un dato de la persona como su teléfono, y mandarlo a otra
  // pantalla obligaba a guardar dos veces para corregir un tipeo. El servidor
  // solo lo aplica si cambió, y solo si quien edita es ADMIN.
  usuario: textoOpcional,
});

export type PersonalFormData = z.infer<typeof personalSchema>;

/**
 * Los ids de un borrado en lote. El tope no es decorativo: cada ficha se
 * archiva sola, así que mil ids son mil idas a la base en una sola petición.
 */
export const eliminarEnLoteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

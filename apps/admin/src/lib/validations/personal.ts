import { z } from "zod/v4";

const telefonoEcuadorRegex = /^(\+593|0)(9\d{8}|[2-7]\d{7})$/;

export const personalSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().optional().or(z.literal("")),
  telefono: z.string().regex(telefonoEcuadorRegex, "Número inválido. Ej: 0991234567 o +593991234567").optional().or(z.literal("")),

  especialidad: z.string().optional().or(z.literal("")),
  sueldo: z.union([
    z.coerce.number().positive("Debe ser mayor a 0"),
    z.literal("").transform(() => undefined),
  ]).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
  tipo: z.enum(["JARDINERO", "CHOFER", "SUPERVISOR", "MECANICO"]).optional().or(z.literal("")),
});

export type PersonalFormData = z.infer<typeof personalSchema>;

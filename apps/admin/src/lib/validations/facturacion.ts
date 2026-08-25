import { z } from "zod/v4";

/**
 * Los campos que Contífico guarda de una persona, verificado contra su API:
 * `cedula`/`ruc`, `razon_social`, `tipo` (N/J), `direccion`, `telefonos`,
 * `email`. Lo demás que devuelve son banderas internas suyas.
 */
export const datoFacturacionSchema = z.object({
  tipoIdentificacion: z.enum(["CEDULA", "RUC"]),
  identificacion: z.string().trim().min(1, "La identificación es obligatoria"),
  razonSocial: z.string().trim().min(1, "La razón social es obligatoria").max(300),
  tipoPersona: z.enum(["NATURAL", "JURIDICA"]),
  direccion: z.string().trim().max(300).nullable().optional(),
  telefono: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  esPredeterminado: z.boolean().optional(),
  /**
   * Se crea archivado: la orden lo referencia por id, pero no vuelve a
   * ofrecerse. Es el caso de "facturar esta vez a otro nombre" sin dejar la
   * ficha del cliente llena de casos puntuales.
   */
  archivado: z.boolean().optional(),
});

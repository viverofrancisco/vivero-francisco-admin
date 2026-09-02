import { z } from "zod/v4";

/**
 * Un emisor: a nombre de qué RUC sale el comprobante ante el SRI.
 *
 * Los campos son los que el XML exige en `infoTributaria`. El certificado va
 * por otra puerta —es un archivo y una contraseña— y nunca vuelve en una
 * respuesta.
 */
export const emisorSchema = z.object({
  ruc: z.string().regex(/^\d{13}$/, "El RUC tiene que ser de 13 dígitos"),
  razonSocial: z.string().min(1, "La razón social es obligatoria"),
  nombreComercial: z.string().nullable().optional(),
  dirMatriz: z.string().min(1, "La dirección de la matriz es obligatoria"),
  direccionEstablecimiento: z
    .string()
    .min(1, "La dirección del establecimiento es obligatoria"),
  establecimiento: z.string().regex(/^\d{3}$/, "Tres dígitos, como 001"),
  puntoEmision: z.string().regex(/^\d{3}$/, "Tres dígitos, como 001"),
  obligadoContabilidad: z.boolean(),
  /** Número de resolución. Vacío = no lo es. */
  contribuyenteEspecial: z.string().nullable().optional(),
  agenteRetencion: z.string().nullable().optional(),
  ambiente: z.enum(["PRUEBAS", "PRODUCCION"]),
  activo: z.boolean().optional(),
  predeterminado: z.boolean().optional(),
});

export type EmisorFormData = z.infer<typeof emisorSchema>;

/**
 * Los estados de una factura electrónica, tal como los reporta Contífico.
 *
 * No son estados nuestros: describen dónde está el documento en el camino al
 * SRI. Contífico firma y transmite en tandas —más o menos cada hora—, así que
 * una factura recién emitida arranca sin firmar y avanza sola.
 */
export const ESTADO_FACTURA_LABEL: Record<string, string> = {
  PENDIENTE: "Sin firmar",
  FIRMADO: "Firmada",
  ENVIADO_SRI: "Enviada al SRI",
  AUTORIZADO: "Autorizada",
  RECHAZADO: "Rechazada",
};

/** Qué significa cada estado, para el `title` del badge. */
export const ESTADO_FACTURA_AYUDA: Record<string, string> = {
  PENDIENTE:
    "Contífico todavía no le puso la firma electrónica. Firma en tandas, aproximadamente cada hora, así que suele resolverse solo. Mientras tanto la factura existe pero no vale ante el SRI.",
  FIRMADO:
    "Ya tiene la firma electrónica, pero Contífico todavía no se la mandó al SRI.",
  ENVIADO_SRI:
    "Contífico se la mandó al SRI y está esperando la respuesta.",
  AUTORIZADO:
    "El SRI la aceptó. Es un comprobante válido y ya no se puede anular desde el portal: hay que emitir una nota de crédito.",
  RECHAZADO:
    "El SRI la rechazó, casi siempre por un dato del cliente o del producto. Hay que corregir y volver a emitir.",
};

export const ESTADO_FACTURA_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDIENTE: "outline",
  FIRMADO: "secondary",
  ENVIADO_SRI: "secondary",
  AUTORIZADO: "default",
  RECHAZADO: "destructive",
};

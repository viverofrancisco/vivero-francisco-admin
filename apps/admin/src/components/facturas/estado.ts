/**
 * Dónde está la factura en el camino al SRI.
 *
 * El portal firma y manda en el momento, así que lo normal es que una emisión
 * termine directo en `AUTORIZADO` o en `RECHAZADO`. Los estados del medio son
 * para cuando el SRI no contesta enseguida — tiene 24 horas por norma— y ahí
 * los resuelve el cron o el botón *Consultar al SRI*.
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
    "Quedó sin firmar: la emisión no llegó a completarse. La factura existe con su número reservado, pero no vale ante el SRI.",
  FIRMADO:
    "Ya tiene la firma electrónica, pero todavía no se la aceptaron en recepción.",
  ENVIADO_SRI:
    "El SRI la recibió y todavía no la resolvió. Tiene 24 horas por norma, aunque casi siempre contesta en segundos: se vuelve a consultar sola, o con *Consultar al SRI*.",
  AUTORIZADO:
    "El SRI la aceptó. Es un comprobante válido y ya no se anula desde el portal: se corrige con una nota de crédito.",
  RECHAZADO:
    "El SRI la rechazó, casi siempre por un dato del cliente. El motivo exacto está en la ficha de la orden. Hay que corregir y volver a emitir.",
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

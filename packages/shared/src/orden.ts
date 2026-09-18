/**
 * Si una orden está cobrada, y cuánto.
 *
 * **Es un eje distinto del estado de la orden.** `EstadoOrden` es
 * `BORRADOR | CONFIRMADA | ANULADA` —confirmada quiere decir "tiene factura
 * viva"— y si entró la plata lo dice el **saldo de esa factura**, que se
 * recalcula sumando los cobros y nunca restando sobre lo guardado. Por eso esto
 * se deriva y no se guarda en ninguna columna.
 *
 * Vive en compartido porque el portal y la app muestran la misma fila y la
 * misma ficha; con la regla escrita dos veces, una de las dos iba a redondear
 * distinto.
 */
export type EstadoCobro =
  | "SIN_COBRAR"
  | "PARCIAL"
  | "COBRADO"
  | "SIN_SINCRONIZAR";

export function estadoCobro(
  total: number,
  saldo: number | null | undefined
): EstadoCobro {
  // Sin saldo calculado no sabemos, y suponer "cobrada" sería el error caro.
  // Lo emitido por el portal nace con el total como saldo, así que esto solo
  // aparece en filas viejas.
  if (saldo === null || saldo === undefined) return "SIN_SINCRONIZAR";
  if (saldo <= 0.001) return "COBRADO";
  if (saldo >= total - 0.001) return "SIN_COBRAR";
  return "PARCIAL";
}

export const cobroLabel: Record<EstadoCobro, string> = {
  SIN_COBRAR: "Sin cobrar",
  PARCIAL: "Cobrado parcialmente",
  COBRADO: "Cobrado",
  SIN_SINCRONIZAR: "Sin sincronizar",
};

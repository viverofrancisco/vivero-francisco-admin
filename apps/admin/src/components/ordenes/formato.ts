/** Formato de plata compartido por las pantallas de órdenes. */
export const money = (n: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n)
  );

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const estadoLabel: Record<string, string> = {
  BORRADOR: "Borrador",
  CONFIRMADA: "Confirmada",
  ANULADA: "Anulada",
};

export const estadoVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  BORRADOR: "outline",
  CONFIRMADA: "secondary",
  ANULADA: "destructive",
};

/**
 * Cuánto se cobró de una orden, que **no** es su estado.
 *
 * El estado dice si la orden está viva; esto dice si entró la plata. Se deriva
 * del saldo de la factura en vez de guardarse: los cobros son de Contífico y
 * pueden cargarse desde su interfaz, así que una copia local sería una copia
 * potencialmente vieja de un número que habla de dinero.
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
  // Nunca sincronizada: no sabemos, y suponer "cobrada" sería el error caro.
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

export const cobroVariant: Record<
  EstadoCobro,
  "default" | "secondary" | "outline" | "destructive"
> = {
  SIN_COBRAR: "outline",
  PARCIAL: "secondary",
  COBRADO: "default",
  SIN_SINCRONIZAR: "outline",
};

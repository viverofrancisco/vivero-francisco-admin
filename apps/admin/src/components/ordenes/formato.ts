import { ZONA_ECUADOR } from "@/lib/fechas";
import type { EstadoCobro } from "@vivero/shared";

/** Formato de plata compartido por las pantallas de órdenes. */
export const money = (n: number | string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n)
  );

/**
 * Una fecha sin hora (columna `@db.Date`).
 *
 * Va en **UTC** a propósito: Prisma devuelve esas columnas como medianoche UTC,
 * y formatearlas en Ecuador (UTC-5) las correría un día para atrás.
 */
export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * La hora de un instante real, en **hora de Ecuador**.
 *
 * Lo contrario del de arriba: acá sí hay un momento concreto guardado, y
 * mostrarlo en UTC daría las 3 de la mañana para algo que pasó a las 22:00.
 */
export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_ECUADOR,
  });

/**
 * ¿Una columna `DATE` y un instante caen el mismo día en Ecuador?
 *
 * Sirve para decidir si tiene sentido pegarle la hora a una fecha: la de la
 * columna se lee en UTC (es medianoche UTC) y la del instante en Ecuador.
 */
export const mismoDia = (fechaIso: string, instanteIso: string) =>
  fechaIso.slice(0, 10) ===
  new Date(instanteIso).toLocaleDateString("en-CA", {
    timeZone: ZONA_ECUADOR,
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
 * del saldo y no se guarda aparte: cruzar los dos ejes en un solo enum pediría
 * un estado por combinación.
 */
export const cobroVariant: Record<
  EstadoCobro,
  "default" | "secondary" | "outline" | "destructive"
> = {
  SIN_COBRAR: "outline",
  PARCIAL: "secondary",
  COBRADO: "default",
  SIN_SINCRONIZAR: "outline",
};

/**
 * La regla de cobro vive en `@vivero/shared` —la app muestra la misma fila— y
 * se reexporta acá para no cambiar los veinte imports que ya la piden de este
 * módulo, que es donde vive el resto del formato de una orden.
 */
export { estadoCobro, cobroLabel } from "@vivero/shared";
export type { EstadoCobro } from "@vivero/shared";

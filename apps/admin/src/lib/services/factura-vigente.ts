/**
 * Cuál es "la factura" de una orden.
 *
 * Desde que las notas de crédito viven en la misma tabla, no alcanza con "la
 * que no está anulada": una nota de crédito tampoco está anulada y sin embargo
 * no es la factura de la orden — es el documento que la corrige. Confundirlas
 * haría que una orden acreditada parezca facturada, que el cobro se registre
 * contra la nota, y que "Por cobrar" cuente al revés.
 *
 * Un solo lugar para la regla, usado por el servicio, las consultas y la
 * pantalla, porque son la misma pregunta hecha en tres lados.
 */
import type { TipoDocumento } from "@/generated/prisma/client";

/** Para un `where` de Prisma. */
export const FACTURA_VIGENTE = {
  anulada: false,
  tipo: { not: "NOTA_CREDITO" as TipoDocumento },
} as const;

/** Para una lista ya cargada. */
export function esFacturaVigente<
  T extends { anulada: boolean; tipo: TipoDocumento },
>(f: T): boolean {
  return !f.anulada && f.tipo !== "NOTA_CREDITO";
}

/** La factura viva de una orden, o `null`. */
export function facturaVigenteDe<
  T extends { anulada: boolean; tipo: TipoDocumento },
>(facturas: T[]): T | null {
  return facturas.find(esFacturaVigente) ?? null;
}

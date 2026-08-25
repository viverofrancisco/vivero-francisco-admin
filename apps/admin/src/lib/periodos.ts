/**
 * Períodos de cobro de una suscripción.
 *
 * Vive aparte de `orden.service` porque la UI también necesita nombrar el
 * período ("visitas por trimestre") sin arrastrar el servicio de facturación
 * entero a un componente cliente.
 */

/** Cuántos meses abarca cada período. */
export const MESES_POR_PERIODO: Record<string, number> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export interface Periodo {
  inicio: Date;
  fin: Date;
}

/**
 * Los períodos de una suscripción hasta una fecha.
 *
 * Se anclan al mes en que arrancó y avanzan de a N meses según la periodicidad,
 * no al calendario: una trimestral que empezó en febrero cobra feb–abr,
 * may–jul, etc. Así el cliente siempre paga períodos completos desde que
 * contrató.
 */
export function periodosDeSuscripcion(
  fechaInicio: Date,
  periodicidad: string,
  hasta: Date
): Periodo[] {
  const paso = MESES_POR_PERIODO[periodicidad] ?? 1;
  const periodos: Periodo[] = [];

  const cursor = new Date(
    Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), 1)
  );
  const limite = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1));

  while (cursor <= limite) {
    const inicio = new Date(cursor);
    // Último día del último mes del período.
    const fin = new Date(
      Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + paso, 0)
    );
    periodos.push({ inicio, fin });
    cursor.setUTCMonth(cursor.getUTCMonth() + paso);
  }
  return periodos;
}

/** Clave estable de un período, como la guarda `OrdenLinea.periodoInicio`. */
export function clavePeriodo(inicio: Date): string {
  return inicio.toISOString().slice(0, 10);
}

const PERIODICIDAD_UNIDAD: Record<string, string> = {
  MENSUAL: "mes",
  TRIMESTRAL: "trimestre",
  SEMESTRAL: "semestre",
  ANUAL: "año",
};

/** "Visitas / trimestre", según la periodicidad del contrato. */
export function unidadDePeriodo(periodicidad: string): string {
  return PERIODICIDAD_UNIDAD[periodicidad] ?? "período";
}

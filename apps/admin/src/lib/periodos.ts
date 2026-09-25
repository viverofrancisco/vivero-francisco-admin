/**
 * Períodos de cobro de una suscripción.
 *
 * Vive aparte de `orden.service` porque la UI también necesita nombrar el
 * período ("visitas por trimestre") sin arrastrar el servicio de facturación
 * entero a un componente cliente.
 */

/** Las etiquetas viven en `@vivero/shared`: la app las muestra igual. */
export { PERIODICIDAD_LABEL, unidadDePeriodo } from "@vivero/shared";

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

const MES_LARGO = new Intl.DateTimeFormat("es-EC", {
  month: "long",
  timeZone: "UTC",
});
// Mes y año a mano y no con `{ month, year }`: en español el formateador mete
// un "de" en el medio ("septiembre de 2026"), y en una factura se escribe
// "SEPTIEMBRE 2026".
const mesYAnio = (d: Date) => `${MES_LARGO.format(d)} ${d.getUTCFullYear()}`;

/**
 * Cómo se nombra un período en una línea de orden: "septiembre 2026",
 * "octubre – diciembre 2026", "noviembre 2026 – abril 2027".
 *
 * En UTC porque así los guarda `OrdenLinea.periodoInicio` (`@db.Date`, ver
 * `periodosDeSuscripcion`): formatearlos en Guayaquil correría el mes al
 * anterior.
 */
export function etiquetaDePeriodo(inicio: Date, fin: Date): string {
  const mismoMes =
    inicio.getUTCFullYear() === fin.getUTCFullYear() &&
    inicio.getUTCMonth() === fin.getUTCMonth();
  if (mismoMes) return mesYAnio(inicio);
  if (inicio.getUTCFullYear() === fin.getUTCFullYear()) {
    return `${MES_LARGO.format(inicio)} – ${mesYAnio(fin)}`;
  }
  return `${mesYAnio(inicio)} – ${mesYAnio(fin)}`;
}

const PERIODICIDAD_ADJETIVO: Record<string, string> = {
  MENSUAL: "mensual",
  TRIMESTRAL: "trimestral",
  SEMESTRAL: "semestral",
  ANUAL: "anual",
};

/**
 * La descripción con la que nace la línea de un período de plan:
 * "Plan mensual · Casa · septiembre 2026".
 *
 * Un plan no tiene nombre ni productos, así que la línea se nombra por lo que
 * es: su ciclo, su jardín y su período. La propiedad va solo cuando el cliente
 * tiene más de una —con una sola se llama "Principal", que en una factura no
 * dice nada—. Es un snapshot: quien emite puede reescribirla al imprimir.
 */
export function descripcionDePeriodoDePlan(
  plan: { periodicidad: string; propiedad: { nombre: string } },
  periodo: Periodo,
  opciones: { nombrarPropiedad: boolean }
): string {
  const partes = [`Plan ${PERIODICIDAD_ADJETIVO[plan.periodicidad] ?? ""}`.trim()];
  if (opciones.nombrarPropiedad) partes.push(plan.propiedad.nombre);
  partes.push(etiquetaDePeriodo(periodo.inicio, periodo.fin));
  return partes.join(" · ");
}

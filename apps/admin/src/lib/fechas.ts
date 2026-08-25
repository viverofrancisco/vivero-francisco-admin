/**
 * "Hoy" en Ecuador, no en UTC.
 *
 * El servidor corre en UTC y `new Date()` truncado a día da **mañana** entre
 * las 19:00 y la medianoche de Ecuador (UTC-5). No es cosmético: `Orden.fecha`
 * y `Factura.fechaEmision` son columnas `DATE`, viajan a Contífico como
 * `fecha_emision` y de ahí al SRI. Una factura emitida a las 22:00 salía con la
 * fecha del día siguiente.
 *
 * Ecuador continental es **UTC-5 fijo**, sin horario de verano, pero igual se
 * usa la zona IANA: si algún día cambia, cambia sola.
 */
export const ZONA_ECUADOR = "America/Guayaquil";

/** `YYYY-MM-DD` del día en curso en Ecuador. */
export function hoyISOEcuador(ahora: Date = new Date()): string {
  // `en-CA` da exactamente `YYYY-MM-DD`, que es lo que se necesita.
  return ahora.toLocaleDateString("en-CA", { timeZone: ZONA_ECUADOR });
}

/**
 * El día en curso en Ecuador, como `Date` a medianoche **UTC**.
 *
 * Es la forma que espera una columna `@db.Date`: Prisma guarda la parte de
 * fecha, y leerla de vuelta con `timeZone: "UTC"` devuelve el mismo día. Poner
 * acá la medianoche local sería correr el día al leerlo.
 */
export function hoyEnEcuador(ahora: Date = new Date()): Date {
  return new Date(`${hoyISOEcuador(ahora)}T00:00:00.000Z`);
}

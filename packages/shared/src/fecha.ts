/**
 * Las fechas que **no tienen hora**.
 *
 * `Visita.fechaProgramada`, `Informe.fecha`, `Orden.fecha` y compañía son
 * columnas `DATE`: un día del calendario, sin hora y sin zona. Prisma las
 * devuelve como un `Date` a **medianoche UTC**, y ahí empieza el problema:
 * `new Date("2026-09-17T00:00:00Z").toLocaleDateString("es-EC")` en Guayaquil
 * (UTC-5) son las 19:00 del 16, así que imprime **el día anterior**. La visita
 * de hoy se leía "miércoles 16 de septiembre" en la ficha mientras la lista,
 * que compara los `YYYY-MM-DD` en crudo, la mostraba bien bajo "Hoy".
 *
 * La regla es una sola: **una fecha sin hora no se pasa por ningún reloj**. Se
 * le sacan los diez primeros caracteres —que son el día tal como está
 * guardado— y se formatea en UTC, que es donde vive esa medianoche. Así da lo
 * mismo dónde corra: el teléfono del jardinero, el navegador de la oficina o
 * el servidor en Vercel imprimen el mismo día.
 *
 * Para un **instante** —`generatedAt`, una marca de entrada— esto es lo que no
 * hay que hacer: ahí la hora es el dato y se formatea en la zona de Ecuador.
 */
const UTC = "UTC";

/** El `YYYY-MM-DD` de una fecha sin hora, venga como texto o como `Date`. */
export function diaISO(valor: string | Date): string {
  return (valor instanceof Date ? valor.toISOString() : valor).slice(0, 10);
}

/**
 * Una fecha sin hora, escrita para leerse. Por defecto "17 de septiembre de 2026".
 *
 * Devuelve el texto tal cual entró si no es una fecha entendible, en vez de
 * "Invalid Date": un dato raro en una fila no debería tapar el resto.
 */
export function fechaSola(
  valor: string | Date,
  opciones: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
  idioma = "es-EC"
): string {
  const dia = diaISO(valor);
  const d = new Date(`${dia}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return valor instanceof Date ? "" : valor;
  }
  return d.toLocaleDateString(idioma, { ...opciones, timeZone: UTC });
}

/** La misma fecha con la primera letra en mayúscula: "Jueves, 17 de septiembre". */
export function fechaSolaCapitalizada(
  valor: string | Date,
  opciones?: Intl.DateTimeFormatOptions,
  idioma?: string
): string {
  const texto = fechaSola(valor, opciones, idioma);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El día que cae `dias` después, como `YYYY-MM-DD`.
 *
 * Se mueve en UTC, así que no hay hora de verano ni medianoche local que corra
 * el resultado. Sirve para comparar días entre sí: en ese formato el texto
 * ordena igual que la fecha, así que `"2026-09-17" < "2026-09-24"` alcanza y no
 * hace falta volver a `Date`.
 */
export function sumarDias(valor: string | Date, dias: number): string {
  const d = new Date(`${diaISO(valor)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

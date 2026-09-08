/**
 * El texto plano del encabezado, sin depender de nada.
 *
 * Vive aparte de `encabezado.ts` a propósito: aquel usa `htmlparser2` para
 * traducir el formato al PDF, y esto lo necesita también el asistente, que
 * corre en el navegador. Con expresiones regulares alcanza para lo único que
 * hace falta ahí: sacar la primera línea para nombrar el informe en las listas.
 */

const SIN_ETIQUETAS = /<[^>]+>/g;

function decodificar(t: string): string {
  return t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * La primera línea con texto, sin formato. `null` si no hay ninguna.
 *
 * Es lo que se muestra en la lista de informes y lo que busca el buscador: el
 * encabezado entero puede tener tres renglones y ahí entra una frase.
 */
export function primeraLineaPlana(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  const bloques = html
    // Corta por bloque. El `<br>` no: es un corte **adentro** de la línea, y
    // la línea entera es lo que nombra al informe —igual que del lado del
    // servidor, que es quien guarda el nombre definitivo.
    .replace(/<br\s*\/?>/gi, " ")
    .split(/<\/(?:p|h1|h2|h3|li|div)>/i)
    .map((b) => decodificar(b.replace(SIN_ETIQUETAS, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return bloques[0] ?? null;
}

const escapar = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * El encabezado que se ofrece cuando todavía no hay uno: exactamente las dos
 * líneas que el PDF venía armando solo.
 *
 * Se usa al abrir el editor y al imprimir un informe viejo, que no tiene
 * encabezado guardado. Así nada cambia de aspecto por haber agregado el campo.
 */
/** Los colores del documento, para que el default salga como siempre salió. */
export const VERDE_INFORME = "#226633";
export const AZUL_INFORME = "#1a4178";

export function encabezadoPorDefecto(
  titulo: string,
  nombreDelCliente: string | null
): string {
  const segunda = nombreDelCliente
    ? `ACTIVIDADES REALIZADAS PARA ${nombreDelCliente.toUpperCase()}`
    : "ACTIVIDADES REALIZADAS";
  // Todo explícito —tamaño, color y marcas— y nada metido en un estilo de
  // línea: así cada control del editor hace algo que se ve, y esto sale
  // idéntico a lo que el PDF venía imprimiendo (título de 14 pt en verde,
  // negrita, cursiva y subrayado; la segunda línea de 12 pt en azul y negrita).
  return (
    `<p><span style="font-size: 14pt; color: ${VERDE_INFORME}">` +
    `<strong><em><u>${escapar(titulo.toUpperCase())}</u></em></strong>` +
    `</span></p>` +
    `<p><span style="font-size: 12pt; color: ${AZUL_INFORME}">` +
    `<strong>${escapar(segunda)}</strong>` +
    `</span></p>`
  );
}

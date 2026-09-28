/**
 * El encabezado del informe, en lo que las dos apps comparten.
 *
 * El portal lo escribe con un editor de texto rico y lo guarda como HTML; la
 * app no tiene editor, así que lo escribe **por renglones** en un campo de
 * varias líneas y lo traduce a ese mismo HTML con los estilos de siempre: la
 * primera línea como título y las demás como subtítulo. Estar acá es lo que
 * hace que el informe que sale de la app imprima igual que el del portal.
 */

/** Los colores del documento, para que el default salga como siempre salió. */
export const VERDE_INFORME = "#226633";
export const AZUL_INFORME = "#1a4178";

const SIN_ETIQUETAS = /<[^>]+>/g;

export function decodificarEntidades(t: string): string {
  return t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * La primera línea con texto, sin formato. `null` si no hay ninguna.
 *
 * Es lo que se muestra en la lista de informes y lo que busca el buscador: el
 * encabezado entero puede tener tres renglones y ahí entra una frase.
 */
export function primeraLineaPlana(html: string | null | undefined): string | null {
  return lineasDelEncabezado(html)[0] ?? null;
}

/**
 * Las líneas del encabezado, sin formato: una por bloque, y un `<br>` corta
 * también. Es lo que la app pone en su campo para editarlo.
 */
export function lineasDelEncabezado(html: string | null | undefined): string[] {
  if (!html?.trim()) return [];
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/<\/(?:p|h1|h2|h3|li|div)>/i)
    .flatMap((b) => b.split("\n"))
    .map((l) =>
      decodificarEntidades(l.replace(SIN_ETIQUETAS, "")).replace(/\s+/g, " ").trim()
    )
    .filter(Boolean);
}

/**
 * El encabezado a partir de líneas sin formato: la primera en el estilo del
 * título (14 pt, verde, negrita, cursiva y subrayado) y las demás en el del
 * subtítulo (12 pt, azul, negrita) —exactamente lo que el PDF venía
 * imprimiendo—. Todo explícito y nada metido en un estilo de línea: así cada
 * control del editor del portal hace algo que se ve.
 *
 * No filtra ni recorta: las líneas van como llegan. Quien las escribe decide.
 */
export function encabezadoDesdeLineas(lineas: string[]): string {
  return lineas
    .map((l, i) =>
      i === 0
        ? `<p><span style="font-size: 14pt; color: ${VERDE_INFORME}">` +
          `<strong><em><u>${escaparHtml(l)}</u></em></strong>` +
          `</span></p>`
        : `<p><span style="font-size: 12pt; color: ${AZUL_INFORME}">` +
          `<strong>${escaparHtml(l)}</strong>` +
          `</span></p>`
    )
    .join("");
}

/**
 * El encabezado que se ofrece cuando todavía no hay uno: exactamente las dos
 * líneas que el PDF venía armando solo.
 *
 * Se usa al abrir el editor, al arrancar el asistente de la app y al imprimir
 * un informe viejo, que no tiene encabezado guardado. Así nada cambia de
 * aspecto por haber agregado el campo.
 */
export function encabezadoPorDefecto(
  titulo: string,
  nombreDelCliente: string | null
): string {
  const segunda = nombreDelCliente
    ? `ACTIVIDADES REALIZADAS PARA ${nombreDelCliente.toUpperCase()}`
    : "ACTIVIDADES REALIZADAS";
  return encabezadoDesdeLineas([titulo.toUpperCase(), segunda]);
}

// ───────── El texto de una sección ─────────
//
// Lo que el portal escribe con el editor y la app con el suyo: un solo
// campo, la primera línea como título y lo que sigue como descripción, y
// guardado en lo más simple que lo represente. Estaba en el admin; la app lo
// necesita para partir y simplificar lo que devuelve su editor.

const ETIQUETA = /<[a-z][^>]*>/i;

/** Si trae etiquetas: lo escrito con el editor, contra lo plano de antes. */
export function esHtml(texto: string | null | undefined): boolean {
  return !!texto && ETIQUETA.test(texto);
}

/**
 * Texto plano → HTML para el editor: un `<p>` por renglón. Lo que ya es HTML
 * pasa tal cual. Tiptap recibe HTML, y un texto con saltos de línea entraría
 * como un solo párrafo con los saltos comidos.
 */
export function aHtml(texto: string | null | undefined): string {
  if (!texto) return "";
  if (esHtml(texto)) return texto;
  return texto
    .split(/\r?\n/)
    .map((l) => `<p>${escaparHtml(l)}</p>`)
    .join("");
}

/**
 * Lo que devuelve el editor, guardado en lo más simple que lo represente: sin
 * ningún formato, texto plano con un salto por párrafo —igual que lo escrito
 * a mano antes del editor—; con formato, el HTML.
 *
 * Es lo que hace que reabrir un informe viejo y guardarlo sin tocar no lo
 * cambie: "Poda de césped" entra al editor como `<p>Poda de césped</p>` y sale
 * como "Poda de césped", y una versión nueva nace solo cuando cambia lo que
 * se imprime.
 */
export function simplificarHtml(html: string | null | undefined): string {
  if (!html) return "";
  // Cualquier etiqueta que no sea un `<p>` a secas, `</p>` o `<br>` es formato.
  if (/<(?!\/?p>|br\s*\/?>)[^>]*>/i.test(html)) return html.trim();
  const lineas = html
    .split(/<\/p>/i)
    .map((b) =>
      decodificarEntidades(b.replace(/<br\s*\/?>/gi, "\n").replace(SIN_ETIQUETAS, ""))
    );
  while (lineas.length > 0 && lineas[lineas.length - 1].trim() === "") lineas.pop();
  while (lineas.length > 0 && lineas[0].trim() === "") lineas.shift();
  return lineas.join("\n");
}

/**
 * El texto de un título o una descripción, sin formato: para las listas, el
 * encabezado colapsado de una sección y para saber si hay algo escrito.
 */
export function textoPlanoDeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodificarEntidades(
    html
      .replace(/<\/(?:p|li|h\d|ul|ol|div)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(SIN_ETIQUETAS, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parte el HTML del editor en su primer bloque y el resto.
 *
 * Una sección se escribe en **un** campo: la primera línea es el título y lo
 * que sigue, la descripción. El editor devuelve una fila de bloques de
 * primer nivel —párrafos y listas— y esto corta después del primero, contando
 * las listas anidadas para no cortar una por la mitad. Texto sin etiquetas se
 * parte en el primer salto de línea.
 */
export function partirPrimerBloque(html: string | null | undefined): {
  primero: string;
  resto: string;
} {
  if (!html) return { primero: "", resto: "" };
  if (!esHtml(html)) {
    const corte = html.indexOf("\n");
    return corte < 0
      ? { primero: html, resto: "" }
      : { primero: html.slice(0, corte), resto: html.slice(corte + 1) };
  }
  const etiquetas = /<\/?(p|ul|ol)\b[^>]*>/gi;
  let profundidad = 0;
  let m: RegExpExecArray | null;
  while ((m = etiquetas.exec(html)) !== null) {
    const cierra = m[0].startsWith("</");
    profundidad += cierra ? -1 : 1;
    if (profundidad === 0) {
      const fin = m.index + m[0].length;
      return { primero: html.slice(0, fin), resto: html.slice(fin) };
    }
  }
  return { primero: html, resto: "" };
}

// ───────── Lo que los editores ofrecen ─────────
//
// Las fuentes, los tamaños y los colores que el PDF sabe imprimir, para el
// editor del portal y el de la app: dos listas se separan a la primera
// fuente nueva.

/**
 * Las familias que el informe puede imprimir: las tres que el PDF trae adentro
 * —Helvetica, Times y Courier, de las catorce fuentes estándar— y siete de
 * Google Fonts embarcadas en el admin como archivos (`fuentes/`) y
 * registradas en cada render (`fuentes.ts`). Cada una con sus cuatro caras.
 */
export type FuenteDelInforme =
  | "HELVETICA"
  | "TIMES"
  | "COURIER"
  | "ROBOTO"
  | "OPEN_SANS"
  | "LATO"
  | "MONTSERRAT"
  | "POPPINS"
  | "MERRIWEATHER"
  | "PLAYFAIR";

/** Cómo escribe el editor cada familia en el `font-family` del HTML. */
export const CSS_DE_FUENTE: Record<FuenteDelInforme, string> = {
  HELVETICA: "Helvetica",
  TIMES: "Times New Roman",
  COURIER: "Courier New",
  ROBOTO: "Roboto",
  OPEN_SANS: "Open Sans",
  LATO: "Lato",
  MONTSERRAT: "Montserrat",
  POPPINS: "Poppins",
  MERRIWEATHER: "Merriweather",
  PLAYFAIR: "Playfair Display",
};

/** El nombre que se muestra, y el orden en que se ofrecen. */
export const FUENTES_DEL_INFORME: Array<{ valor: FuenteDelInforme; nombre: string }> = [
  { valor: "HELVETICA", nombre: "Helvetica" },
  { valor: "ROBOTO", nombre: "Roboto" },
  { valor: "OPEN_SANS", nombre: "Open Sans" },
  { valor: "LATO", nombre: "Lato" },
  { valor: "MONTSERRAT", nombre: "Montserrat" },
  { valor: "POPPINS", nombre: "Poppins" },
  { valor: "TIMES", nombre: "Times New Roman" },
  { valor: "MERRIWEATHER", nombre: "Merriweather" },
  { valor: "PLAYFAIR", nombre: "Playfair Display" },
  { valor: "COURIER", nombre: "Courier New" },
];

/**
 * La familia detrás de un `font-family` de CSS, con o sin comillas y con
 * alternativas después de la coma: el navegador normaliza el `style` al
 * releerlo y puede devolver `"Times New Roman", serif`.
 */
export function fuenteDesdeCss(valor: string | null | undefined): FuenteDelInforme | undefined {
  if (!valor) return undefined;
  const primera = valor
    .split(",")[0]
    .replace(/&quot;/g, "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
  return (Object.keys(CSS_DE_FUENTE) as FuenteDelInforme[]).find(
    (f) => CSS_DE_FUENTE[f].toLowerCase() === primera
  );
}

/**
 * La hoja de Google Fonts con las siete embarcadas, para que lo que se elige
 * en el editor sea lo que se ve. Las tres estándar las tiene cualquier
 * sistema.
 */
export const HOJA_DE_FUENTES_DEL_INFORME =
  "https://fonts.googleapis.com/css2?" +
  ["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Merriweather", "Playfair Display"]
    .map((f) => `family=${f.replace(/ /g, "+")}:ital,wght@0,400;0,700;1,400;1,700`)
    .join("&") +
  "&display=swap";

/** Los tamaños que se ofrecen, en puntos: el número elegido es el que imprime el PDF. */
export const TAMANOS_DEL_INFORME = [10, 11, 12, 14, 16, 18, 20, 24];

/** Las muestras de color: los dos del documento y unos pocos más. */
export const COLORES_DEL_INFORME = [
  VERDE_INFORME,
  AZUL_INFORME,
  "#a11212",
  "#b45309",
  "#b8a300",
  "#0f766e",
  "#6b21a8",
];
export const NEUTROS_DEL_INFORME = [
  "#222222",
  "#555555",
  "#888888",
  "#b5b5b5",
  "#d9d9d9",
  "#f2f2f2",
  "#ffffff",
];

// ───────── El título de una sección ─────────

/**
 * Cómo se muestra y se imprime un título de sección que **no** trae formato:
 * en negrita y subrayado, que es lo de siempre. Es lo que el editor abre
 * cuando el título es texto plano —el de la tarea, o el de un informe
 * viejo—, para que lo que se ve sea lo que sale; y lo que el PDF parsea, así
 * que las dos cosas coinciden por construcción. Un título con formato va
 * como está.
 */
export function tituloDeSeccionEnHtml(titulo: string | null | undefined): string {
  if (!titulo) return "";
  if (esHtml(titulo)) return titulo;
  return `<p><strong><u>${escaparHtml(titulo)}</u></strong></p>`;
}

/** Exactamente el envoltorio de arriba, con las dos marcas en cualquier orden. */
const ENVOLTORIO_DE_TITULO =
  /^<p>(?:<strong><u>|<u><strong>)([^<]*)(?:<\/u><\/strong>|<\/strong><\/u>)<\/p>$/;

/**
 * Lo que devuelve el editor por el título, guardado sin perder lo que se
 * decidió. Si es exactamente el de siempre —negrita y subrayado y nada más—
 * queda **plano**, como se guardaba, y un informe viejo reabierto sin tocar
 * sigue comparando igual y no nace una versión. Si trae otro formato, queda
 * el HTML. Y si no trae **ninguna** marca, queda igual como HTML (`<p>…</p>`)
 * y no como texto plano: plano querría decir "lo de siempre" y se imprimiría
 * en negrita, que es justo lo que se acaba de quitar. Las marcas son lo de
 * omisión para que sea fácil, no una regla.
 *
 * **Lo que ya llega plano se queda plano.** Esa regla es para lo que devuelve
 * el editor, que siempre es HTML. El nombre de una tarea en una sección que
 * nadie abrió, o un título escrito en la app, llegan como texto sin etiquetas
 * y quieren decir "lo de siempre"; convertirlos en `<p>…</p>` los dejaba sin
 * negrita ni subrayado en el PDF mientras el editor los mostraba con las dos.
 */
export function simplificarTitulo(html: string | null | undefined): string {
  if (!html) return "";
  const limpio = html.trim();
  if (!esHtml(limpio)) return limpio;
  const canonico = ENVOLTORIO_DE_TITULO.exec(limpio);
  if (canonico) return decodificarEntidades(canonico[1]).trim();
  const simple = simplificarHtml(limpio);
  if (!simple) return "";
  return esHtml(simple) ? simple : aHtml(simple);
}

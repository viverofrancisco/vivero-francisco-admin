/**
 * Limpia el HTML que llega de un editor de texto.
 *
 * **Se corre en el servidor, siempre.** El editor no puede producir un
 * `<script>` —su esquema no lo tiene— pero el cuerpo de un PUT sí, y lo que
 * valida la pantalla no cuenta. Esto es lo que hace que guardar una descripción
 * no sea una forma de dejar un XSS esperando a que alguien la vea.
 *
 * La lista permitida es exactamente lo que el editor ofrece: formato de texto y
 * listas. Nada de enlaces, imágenes ni atributos — un `style` alcanza para
 * tapar media pantalla, y acá no hace falta ninguno.
 *
 * **`sanitize-html` y no DOMPurify.** DOMPurify necesita un DOM, y del lado del
 * servidor eso significa `jsdom`: en el runtime de Vercel su cadena de
 * dependencias termina en un `require()` de un módulo ESM y **tira al cargar el
 * archivo**, o sea que cualquier página que lo importe da 500 antes de ejecutar
 * una línea. Pasó en producción con `/dashboard/productos`.
 *
 * Este trabaja sobre el texto con un parser propio, sin DOM, así que no arrastra
 * nada nativo ni nada que dependa del entorno.
 */
import { simplificarTitulo } from "@vivero/shared";
import sanitizeHtml from "sanitize-html";
import { simplificarHtml } from "@/lib/informes/encabezado-texto";

const ETIQUETAS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
];

/**
 * Lo escrito con el editor del informe —el encabezado, y el título y la
 * descripción de cada sección— se sanea con su propia lista.
 *
 * Ahí sí hacen falta `style`: el tamaño, el color y la fuente de cada pedazo
 * son lo que se imprime, y sin ellos el encabezado saldría todo igual. Se
 * permiten **solo** esos cinco, y `sanitize-html` valida el valor contra la
 * expresión regular: un `style` libre alcanza para tapar media pantalla. Las
 * listas entran porque el editor las ofrece y el PDF las dibuja.
 */
export function sanitizarEncabezado(
  html: string | null | undefined
): string | null {
  if (!html) return null;
  const limpio = sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "span",
      "h2",
      "ul",
      "ol",
      "li",
    ],
    allowedAttributes: {
      span: ["style"],
      p: ["style"],
      h2: ["style"],
      li: ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
        "font-size": [/^\d{1,3}(\.\d+)?(pt|px|rem|em)$/],
        // Solo las tres familias que el PDF trae; con o sin comillas, y con
        // las alternativas que el navegador agrega después de la coma.
        "font-family": [
          /^["']?(Helvetica|Arial|Times New Roman|Times|Courier New|Courier|Roboto|Open Sans|Lato|Montserrat|Poppins|Merriweather|Playfair Display)["']?(\s*,\s*[\w\s"'-]+)*$/,
        ],
        "text-align": [/^(left|center|right)$/],
        "background-color": [
          /^#[0-9a-fA-F]{3,8}$/,
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
        ],
      },
    },
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  }).trim();
  return limpio === "" || limpio === "<p></p>" ? null : limpio;
}

/**
 * Lo que se guarda de un título o una descripción de sección: saneado con la
 * lista del editor y, si no trae formato alguno, reducido al texto plano de
 * siempre —así lo que entró plano sale plano, y un informe reabierto sin
 * tocar no cambia.
 */
/**
 * Lo mismo para el **título** de una sección: saneado, y simplificado con la
 * regla del título (`simplificarTitulo`), que distingue "lo de siempre" de
 * "sin ninguna marca" —a la del texto le dan lo mismo—.
 */
export function limpiarTitulo(html: string | null | undefined): string {
  if (!html) return "";
  return simplificarTitulo(sanitizarEncabezado(html) ?? "");
}

export function limpiarTextoRico(html: string | null | undefined): string {
  return simplificarHtml(sanitizarEncabezado(html) ?? "");
}

export function sanitizarHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const limpio = sanitizeHtml(html, {
    allowedTags: ETIQUETAS,
    allowedAttributes: {},
    // Lo que no está permitido se va **con su contenido**: el texto de un
    // `<script>` no es texto que alguien quiso escribir.
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  }).trim();
  // Un párrafo vacío se vería como "tiene descripción" en toda lista que
  // pregunte si la hay.
  return limpio === "" || limpio === "<p></p>" ? null : limpio;
}

/**
 * El texto de un HTML, sin etiquetas.
 *
 * Para las listas: ahí la descripción se muestra en una línea y se busca por
 * ella, y con el HTML crudo buscar "strong" encontraba cualquier cosa en
 * negrita.
 */
export function textoPlano(html: string | null | undefined): string | null {
  if (!html) return null;
  const texto = html
    .replace(/<\/(p|li|h2|h3|ul|ol)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return texto || null;
}

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
import sanitizeHtml from "sanitize-html";

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

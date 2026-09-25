/**
 * El encabezado del informe —y el título y la descripción de cada sección—:
 * de HTML a algo que react-pdf pueda dibujar.
 *
 * El editor guarda HTML —es lo que produce un editor de texto— y react-pdf no
 * entiende HTML: dibuja `<Text>` con estilos. Acá está la traducción.
 *
 * - Cada bloque (`<p>`, `<h2>`) es una **línea**; `<br>` corta adentro de una.
 * - Un `<li>` es una línea con viñeta —el punto, o su número en un `<ol>`— y
 *   con la sangría de cuántas listas lo envuelven.
 * - `<strong>`, `<em>` y `<u>` marcan el pedazo que envuelven.
 * - `style="font-size: 14pt; color: #226633; font-family: Times New Roman"`
 *   es el tamaño, el color y la fuente de ese pedazo. Son lo que hace que el
 *   texto no sea todo igual, así que viajan en el HTML y `sanitizarEncabezado`
 *   los deja pasar —solo esos, con el fondo y la alineación—.
 *
 * Sin DOM: se parsea con `htmlparser2`, igual que `sanitize-html`. En el
 * runtime de Vercel cualquier cosa que arrastre `jsdom` tira al cargar el
 * archivo (ver `html-seguro.ts`).
 */
import { Parser } from "htmlparser2";

export { encabezadoPorDefecto, primeraLineaPlana } from "./encabezado-texto";

/** Un pedazo de texto con el formato que le toca. */
export interface TrozoEncabezado {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
  /** En puntos. Ausente = el tamaño de base del encabezado. */
  tamano?: number;
  /** Color CSS tal como se escribió. Ausente = el color de base. */
  color?: string;
  /** Color de fondo del pedazo. Ausente = sin fondo. */
  fondo?: string;
  /** La familia tipográfica. Ausente = Helvetica, la del documento. */
  fuente?: FuenteDelInforme;
}

/**
 * Las familias, con su CSS y su orden, viven en `@vivero/shared` (`informe.ts`):
 * el editor de la app las ofrece también. Se reexportan para quien las
 * importaba de acá.
 */
export {
  CSS_DE_FUENTE,
  FUENTES_DEL_INFORME,
  type FuenteDelInforme,
} from "@vivero/shared";
import { CSS_DE_FUENTE, type FuenteDelInforme } from "@vivero/shared";

/**
 * De un `font-family` de CSS a la familia del PDF. Acepta el nombre con o sin
 * comillas y con alternativas después de la coma: el navegador normaliza el
 * `style` al releerlo y puede devolver `"Times New Roman", serif`.
 */
export function fuenteDesdeCss(valor: string): FuenteDelInforme | undefined {
  // Las comillas pueden venir como entidades: el parser no decodifica los
  // atributos, y `sanitize-html` escribe `&quot;Times New Roman&quot;`.
  const primera = valor
    .split(",")[0]
    .replace(/&quot;|&#34;|&#39;|["']/g, "")
    .trim()
    .toLowerCase();
  if (primera === "helvetica" || primera === "arial") return "HELVETICA";
  if (primera === "times new roman" || primera === "times") return "TIMES";
  if (primera === "courier new" || primera === "courier") return "COURIER";
  const embarcada = (Object.keys(CSS_DE_FUENTE) as FuenteDelInforme[]).find(
    (f) => CSS_DE_FUENTE[f].toLowerCase() === primera
  );
  return embarcada;
}

export interface LineaEncabezado {
  trozos: TrozoEncabezado[];
  /** Ausente = centrada, que es como va un encabezado salvo que se diga otra cosa. */
  alineacion?: "left" | "center" | "right";
  /** "•" o "3." si la línea es un ítem de lista. */
  vineta?: string;
  /** Cuántas listas la envuelven: 1 la primera, 2 una anidada. */
  sangria?: number;
}

const MARCAS: Record<string, "negrita" | "cursiva" | "subrayado"> = {
  strong: "negrita",
  b: "negrita",
  em: "cursiva",
  i: "cursiva",
  u: "subrayado",
};

const BLOQUES = new Set(["p", "h1", "h2", "h3", "div"]);

/** Entidades que puede dejar el editor. El resto se copia tal cual. */
function decodificar(crudo: string): string {
  return crudo
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** El tamaño en puntos, venga en pt, px o rem. El PDF mide en puntos. */
function enPuntos(valor: string): number | undefined {
  const m = /^(\d{1,3}(?:\.\d+)?)(pt|px|rem|em)$/.exec(valor.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // 1 px = 0.75 pt; rem/em se toman sobre 16 px, que es lo que usa el editor.
  const factor = m[2] === "pt" ? 1 : m[2] === "px" ? 0.75 : 12;
  return Math.round(n * factor * 100) / 100;
}

function estiloDe(atributos: Record<string, string>) {
  // Las comillas del `style` llegan como entidades —el parser no decodifica
  // atributos y `sanitize-html` escribe `&quot;`— y `&quot;` lleva un `;`
  // adentro, que partía la declaración al cortar por punto y coma.
  const style = atributos.style
    ?.replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;/g, "'");
  if (!style) return {};
  const salida: {
    tamano?: number;
    color?: string;
    fondo?: string;
    fuente?: FuenteDelInforme;
    alineacion?: "left" | "center" | "right";
  } = {};
  for (const decl of style.split(";")) {
    const [prop, ...resto] = decl.split(":");
    const valor = resto.join(":").trim();
    if (!valor) continue;
    const nombre = prop.trim().toLowerCase();
    if (nombre === "color") salida.color = valor;
    if (nombre === "background-color") salida.fondo = valor;
    if (nombre === "font-size") salida.tamano = enPuntos(valor);
    if (nombre === "font-family") salida.fuente = fuenteDesdeCss(valor);
    if (nombre === "text-align" && /^(left|center|right)$/.test(valor)) {
      salida.alineacion = valor as "left" | "center" | "right";
    }
  }
  return salida;
}

/**
 * Las líneas del encabezado, listas para dibujar. HTML vacío = sin líneas.
 *
 * Lo que no reconoce igual aporta su texto: se pierde el formato, no lo que la
 * persona escribió.
 */
export function parsearEncabezado(
  html: string | null | undefined,
  opciones: {
    /**
     * Dejar las líneas sin texto. En una descripción un párrafo vacío es un
     * espacio que alguien puso a propósito —antes de una lista, entre dos
     * ideas— y se imprime como renglón en blanco, igual que en el editor. En
     * el encabezado no: ahí sería un renglón en blanco que nadie escribió.
     */
    conservarVacias?: boolean;
  } = {}
): LineaEncabezado[] {
  if (!html?.trim()) return [];

  const lineas: LineaEncabezado[] = [];
  let actual: LineaEncabezado | null = null;
  /** Lo que está abierto ahora mismo, en orden. */
  const pila: Array<{
    tag: string;
    marca?: "negrita" | "cursiva" | "subrayado";
    tamano?: number;
    color?: string;
    fondo?: string;
    fuente?: FuenteDelInforme;
  }> = [];

  const formatoActual = () => ({
    negrita: pila.some((e) => e.marca === "negrita"),
    cursiva: pila.some((e) => e.marca === "cursiva"),
    subrayado: pila.some((e) => e.marca === "subrayado"),
    // El de más adentro gana, como en CSS.
    tamano: [...pila].reverse().find((e) => e.tamano !== undefined)?.tamano,
    color: [...pila].reverse().find((e) => e.color !== undefined)?.color,
    fondo: [...pila].reverse().find((e) => e.fondo !== undefined)?.fondo,
    fuente: [...pila].reverse().find((e) => e.fuente !== undefined)?.fuente,
  });

  /** Las listas abiertas, de afuera hacia adentro, con su contador. */
  const listas: Array<{ tipo: "ul" | "ol"; contador: number }> = [];

  const abrirLinea = (alineacion?: "left" | "center" | "right") => {
    actual = { trozos: [], ...(alineacion ? { alineacion } : {}) };
    lineas.push(actual);
  };

  const agregar = (t: string) => {
    if (!t) return;
    // Texto suelto fuera de todo bloque: se le da una línea igual.
    if (!actual) abrirLinea();
    const linea = actual!;
    const f = formatoActual();
    const ultimo = linea.trozos[linea.trozos.length - 1];
    // Se juntan los trozos con el mismo formato: `<strong>A</strong><strong>B</strong>
    // son dos etiquetas y una sola palabra.
    if (
      ultimo &&
      ultimo.negrita === f.negrita &&
      ultimo.cursiva === f.cursiva &&
      ultimo.subrayado === f.subrayado &&
      ultimo.tamano === f.tamano &&
      ultimo.color === f.color &&
      ultimo.fondo === f.fondo &&
      ultimo.fuente === f.fuente
    ) {
      ultimo.texto += t;
      return;
    }
    linea.trozos.push({ texto: t, ...f });
  };

  const parser = new Parser(
    {
      onopentag(nombre, atributos) {
        if (nombre === "ul" || nombre === "ol") {
          listas.push({ tipo: nombre, contador: 0 });
          return;
        }
        // Un ítem es una línea con viñeta: el punto, o el número que le toca
        // en su lista. La sangría dice cuántas listas lo envuelven.
        if (nombre === "li") {
          const lista = listas[listas.length - 1];
          const estilo = estiloDe(atributos);
          abrirLinea(estilo.alineacion);
          actual!.vineta =
            lista?.tipo === "ol" ? `${++lista.contador}.` : "•";
          actual!.sangria = Math.max(1, listas.length);
          pila.push({ tag: nombre, ...estilo });
          return;
        }
        if (BLOQUES.has(nombre)) {
          const estilo = estiloDe(atributos);
          // El editor envuelve el texto de un ítem en su propio `<p>`: ese
          // párrafo es la misma línea que el ítem, no una nueva —si no, la del
          // ítem quedaba vacía y la viñeta se perdía con ella.
          const dentroDeItem =
            actual !== null &&
            actual.vineta !== undefined &&
            actual.trozos.length === 0 &&
            pila[pila.length - 1]?.tag === "li";
          if (dentroDeItem) {
            if (estilo.alineacion) actual!.alineacion = estilo.alineacion;
          } else {
            abrirLinea(estilo.alineacion);
          }
          // El estilo del bloque vale para todo lo que tenga adentro.
          pila.push({ tag: nombre, ...estilo });
          return;
        }
        // El salto vive adentro de la línea, no la corta en dos: así el
        // `marginTop` que separa una línea de la siguiente no se duplica.
        if (nombre === "br") return agregar("\n");
        pila.push({
          tag: nombre,
          marca: MARCAS[nombre],
          ...estiloDe(atributos),
        });
      },
      ontext(t) {
        agregar(decodificar(t));
      },
      onclosetag(nombre) {
        if (nombre === "ul" || nombre === "ol") {
          listas.pop();
          return;
        }
        for (let i = pila.length - 1; i >= 0; i--) {
          if (pila[i].tag === nombre) {
            pila.splice(i, 1);
            break;
          }
        }
      },
    },
    { decodeEntities: false }
  );
  parser.write(html);
  parser.end();

  // Las líneas sin texto no se dibujan: un `<p></p>` del editor sería un
  // renglón en blanco que nadie escribió a propósito. Salvo que se pidan.
  if (opciones.conservarVacias) return lineas;
  return lineas.filter((l) => l.trozos.some((t) => t.texto.trim() !== ""));
}

/** Si la línea no tiene texto: un renglón en blanco. */
export function lineaVacia(linea: LineaEncabezado): boolean {
  return linea.trozos.every((t) => t.texto.trim() === "");
}

/** El texto de una línea, sin formato. */
export function textoDeLinea(linea: LineaEncabezado): string {
  return linea.trozos
    .map((t) => t.texto)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cómo se llama el informe en las listas: la primera línea del encabezado.
 *
 * El encabezado entero puede tener tres renglones y formato; una fila de tabla
 * necesita una frase.
 */
export function tituloDelEncabezado(
  html: string | null | undefined
): string | null {
  const lineas = parsearEncabezado(html);
  if (lineas.length === 0) return null;
  return textoDeLinea(lineas[0]) || null;
}

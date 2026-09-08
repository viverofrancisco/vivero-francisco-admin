import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type {
  FotosPorFila,
  InformeRenderData,
  InformeRenderFirmante,
  InformeRenderSeccion,
} from "./template-data";
import type { LineaEncabezado, TrozoEncabezado } from "./encabezado";

// Use built-in Helvetica family. Loading custom fonts at runtime in
// serverless environments is fragile and not worth it for v1.

const COLOR_GREEN = "#226633";
const COLOR_BLUE = "#1a4178";
const COLOR_TEXT = "#222222";
const COLOR_MUTED = "#555555";

const GAP_FOTOS = 6;

/**
 * Cuánto mide una foto según cuántas entren en la fila.
 *
 * El ancho va en porcentaje —de la caja de contenido, que es A4 menos los
 * márgenes— y el alto en puntos, elegido para que la proporción quede parecida
 * en los tres casos. Los porcentajes dejan lugar para los `gap`: 3 × 32% + 2 × 6
 * pt entra en los 515 pt de ancho útil.
 */
const MEDIDA_FOTO: Record<FotosPorFila, { ancho: string; alto: number }> = {
  2: { ancho: "49%", alto: 190 },
  3: { ancho: "32%", alto: 130 },
  4: { ancho: "23.5%", alto: 100 },
};

/**
 * Cuánto contenido tiene que caber después del título para que se quede.
 *
 * Es lo que evita el título solo al pie de una hoja con sus fotos en la
 * siguiente. `minPresenceAhead` le dice al algoritmo de corte que no parta
 * dentro de esos puntos; si no hay tanto lugar, baja el título también.
 *
 * Cuánto pedir depende de qué lo sigue: con descripción alcanzan unas líneas,
 * porque el título ya no queda solo. Sin descripción lo que tiene que
 * acompañarlo es la primera fila de fotos entera, así que se pide su alto. Pedir
 * siempre el alto de una fila era peor: empujaba títulos a la hoja siguiente sin
 * necesidad y dejaba justo el espacio en blanco que se quería evitar.
 */
function espacioMinimoTrasTitulo(seccion: InformeRenderSeccion): number {
  if (seccion.descripcion) return 48;
  if (seccion.fotos.length > 0) {
    return MEDIDA_FOTO[seccion.fotosPorFila].alto + GAP_FOTOS;
  }
  return 24;
}

/** Parte las fotos en filas de a `n`. */
function enFilas<T>(fotos: T[], n: number): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < fotos.length; i += n) filas.push(fotos.slice(i, i + n));
  return filas;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLOR_TEXT,
    backgroundColor: "#fafafa",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 18,
  },
  logo: {
    height: 36,
    width: 110,
    objectFit: "contain",
  },
  topBarSpacer: {
    height: 36,
  },
  titleBlock: {
    marginBottom: 16,
    // **Sin `alignItems: center`**: eso encoge cada línea al ancho de su texto
    // y la centra, así que el `textAlign` de la línea no tenía nada que hacer
    // —alinear a la derecha no movía nada—. Estiradas a todo el ancho, el
    // centrado lo pone `lineaEncabezado` y cada línea puede pedir otro.
  },
  /**
   * Una línea del encabezado. Solo pone lo que **todas** comparten —centrado y
   * separación—; el tamaño, el color y las marcas los decide cada pedazo, que
   * es lo que hace que el editor sirva para algo.
   */
  lineaEncabezado: {
    fontSize: 12,
    color: COLOR_TEXT,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 1.3,
  },
  /** La primera línea no lleva separación: no tiene nada arriba. */
  primeraLinea: {
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLOR_GREEN,
    textDecoration: "underline",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 10,
    lineHeight: 1.45,
    textAlign: "justify",
  },
  photoRow: {
    flexDirection: "row",
    gap: GAP_FOTOS,
    marginBottom: GAP_FOTOS,
  },
  photo: {
    objectFit: "cover",
    borderWidth: 0.5,
    borderColor: "#bbbbbb",
  },
  watermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.06,
  },
  watermarkImage: {
    width: "65%",
    objectFit: "contain",
  },
  signaturesBlock: {
    marginTop: 36,
  },
  signaturesIntro: {
    fontFamily: "Helvetica-BoldOblique",
    fontSize: 12,
    color: COLOR_TEXT,
  },
  signaturesRow: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "flex-start",
    flexWrap: "wrap",
  },
  signatureCell: {
    width: 180,
    marginRight: 32,
    alignItems: "flex-start",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: COLOR_TEXT,
    width: "100%",
    marginBottom: 4,
  },
  signatureName: {
    fontFamily: "Helvetica-BoldOblique",
    fontSize: 11,
    textAlign: "left",
  },
  signatureCedula: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    textAlign: "left",
    color: COLOR_MUTED,
  },
});

/** Cuántas veces se vuelve a maquetar buscando títulos huérfanos. */
const MAX_PASADAS = 3;

/**
 * Arma el PDF, y si algún título quedó solo al pie de una hoja, lo vuelve a
 * armar bajando esa sección a la hoja siguiente.
 *
 * **Por qué mirar el resultado en vez de prevenirlo.** react-pdf tiene
 * `minPresenceAhead` justamente para esto, y no alcanza: cuánto espacio pedir
 * depende de cuántas líneas de la descripción van a entrar, y eso solo se sabe
 * después de maquetar. Con un número fijo o se cuelan huérfanos —pasó, con 136
 * pt libres el título se quedó y el párrafo entero bajó— o se empujan títulos
 * de más y queda el espacio en blanco gigante que se quería evitar.
 *
 * Así que se maqueta, se mira dónde cayó cada cosa y se corrige. Converge
 * rápido —bajar una sección no suele crear otro huérfano— y por las dudas hay
 * tope de pasadas: el informe sale igual, con algún título suelto, antes que
 * quedarse dando vueltas.
 */
export async function renderInformePDF(
  data: InformeRenderData,
): Promise<Buffer> {
  const forzados = new Set<number>();
  let ultimo: Buffer | null = null;

  for (let pasada = 0; pasada < MAX_PASADAS; pasada++) {
    const { buffer, huerfanos } = await armar(data, forzados);
    ultimo = buffer;
    const nuevos = huerfanos.filter((i) => !forzados.has(i));
    if (nuevos.length === 0) break;
    for (const i of nuevos) forzados.add(i);
  }

  return ultimo!;
}

/** Una pasada: el PDF y qué secciones quedaron con el título solo al pie. */
async function armar(
  data: InformeRenderData,
  forzados: Set<number>,
): Promise<{ buffer: Buffer; huerfanos: number[] }> {
  let arbol: NodoMaquetado | null = null;
  const doc = (
    <InformeDocument
      data={data}
      forzados={forzados}
      // El árbol ya maquetado, que es lo único que sabe en qué hoja cayó cada
      // cosa. Es API interna de react-pdf (de ahí el nombre), así que si un día
      // deja de venir no se rompe nada: sin árbol no hay corrección y el
      // informe sale como salía antes.
      onRender={(e) => {
        // El tipo público de `onRender` solo declara `blob`; el árbol viaja al
        // lado y hay que pedirlo con un cast.
        arbol =
          (e as { _INTERNAL__LAYOUT__DATA_?: NodoMaquetado })
            ._INTERNAL__LAYOUT__DATA_ ?? null;
      }}
    />
  );

  // `.toBuffer()` returns a Node Readable stream. Drain it to a Buffer.
  const stream = await pdf(doc).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    huerfanos: titulosAlPie(arbol),
  };
}

interface NodoMaquetado {
  type?: string;
  props?: Record<string, unknown>;
  box?: { height: number };
  children?: NodoMaquetado[];
}

/**
 * Qué secciones terminaron con su título como última cosa de la hoja.
 *
 * Se saltean los nodos `fixed` —el logo y la marca de agua se repiten en todas
 * las páginas y serían siempre lo último— y los de altura 0: cuando react-pdf
 * mueve algo a la hoja siguiente deja un clon vacío atrás.
 */
function titulosAlPie(arbol: NodoMaquetado | null): number[] {
  if (!arbol?.children) return [];
  const huerfanos: number[] = [];

  for (const pagina of arbol.children) {
    let ultimo: NodoMaquetado | null = null;
    const bajar = (n: NodoMaquetado) => {
      if (n.props?.fixed) return;
      if (
        (n.box?.height ?? 0) > 0 &&
        (n.type === "TEXT" || n.type === "IMAGE")
      ) {
        ultimo = n;
      }
      if (n.type === "TEXT") return; // sus hijos son los renglones
      for (const c of n.children ?? []) bajar(c);
    };
    bajar(pagina);

    const id = (ultimo as NodoMaquetado | null)?.props?.id;
    if (typeof id === "string" && id.startsWith(ID_TITULO)) {
      huerfanos.push(Number(id.slice(ID_TITULO.length)));
    }
  }
  return huerfanos;
}

/** Prefijo del `id` con que se reconoce un título en el árbol maquetado. */
const ID_TITULO = "titulo-";

function InformeDocument({
  data,
  forzados,
  onRender,
}: {
  data: InformeRenderData;
  /** Secciones que arrancan en hoja nueva porque su título quedó huérfano. */
  forzados: Set<number>;
  onRender: NonNullable<DocumentProps["onRender"]>;
}) {
  return (
    <Document onRender={onRender}>
      <Page size="A4" style={styles.page} wrap>
        {data.logo ? (
          <View style={styles.watermark} fixed>
            <Image
              style={styles.watermarkImage}
              src={{
                data: Buffer.from(data.logo.bytes),
                format: data.logo.format,
              }}
            />
          </View>
        ) : null}
        <View style={styles.topBar} fixed>
          {data.logo ? (
            <Image
              style={styles.logo}
              src={{
                data: Buffer.from(data.logo.bytes),
                format: data.logo.format,
              }}
            />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
          <Text>Samborondón, {formatLongDate(data.fecha)}</Text>
        </View>
        <View style={styles.titleBlock}>
          {data.encabezado.map((linea, i) => (
            <LineaDelEncabezado key={i} linea={linea} primera={i === 0} />
          ))}
        </View>

        {data.secciones.map((seccion, i) => (
          <Section
            key={i}
            indice={i}
            seccion={seccion}
            forzarSalto={forzados.has(i)}
          />
        ))}

        <SignaturesBlock data={data} />
      </Page>
    </Document>
  );
}

/**
 * Una línea del encabezado.
 *
 * El estilo de base lo pone el tipo de línea —título o subtítulo, que son los
 * dos que el documento tuvo siempre— y encima se suman las marcas de cada
 * pedazo. Como negrita y cursiva en Helvetica son **familias distintas** y no
 * atributos, la combinación se resuelve con una tabla en vez de acumular
 * estilos: pedirle `fontWeight: bold` a Helvetica-Oblique no la vuelve
 * Helvetica-BoldOblique.
 */
function LineaDelEncabezado({
  linea,
  primera,
}: {
  linea: LineaEncabezado;
  primera: boolean;
}) {
  return (
    <Text
      style={[
        styles.lineaEncabezado,
        primera ? styles.primeraLinea : {},
        // Centrada salvo que se haya dicho otra cosa: es como va un encabezado.
        linea.alineacion ? { textAlign: linea.alineacion } : {},
      ]}
    >
      {linea.trozos.map((trozo, i) => (
        <Text key={i} style={estiloDelTrozo(trozo)}>
          {trozo.texto}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Helvetica no combina: cada mezcla de negrita y cursiva es **otra familia**.
 * Pedirle `fontWeight: bold` a Helvetica-Oblique no la vuelve
 * Helvetica-BoldOblique, así que la combinación se elige de una tabla.
 */
const FAMILIA = {
  "": "Helvetica",
  b: "Helvetica-Bold",
  i: "Helvetica-Oblique",
  bi: "Helvetica-BoldOblique",
} as const;

function estiloDelTrozo(trozo: TrozoEncabezado) {
  const clave = `${trozo.negrita ? "b" : ""}${
    trozo.cursiva ? "i" : ""
  }` as keyof typeof FAMILIA;
  return {
    fontFamily: FAMILIA[clave],
    textDecoration: trozo.subrayado ? ("underline" as const) : ("none" as const),
    // Ausentes = lo que diga la línea. El editor los escribe siempre en el
    // encabezado que propone, así que en la práctica vienen.
    ...(trozo.tamano !== undefined ? { fontSize: trozo.tamano } : {}),
    ...(trozo.color !== undefined ? { color: trozo.color } : {}),
    ...(trozo.fondo !== undefined ? { backgroundColor: trozo.fondo } : {}),
  };
}

/**
 * Una sección, **sin envolverla en un `View`**. Esto no es un detalle de
 * estilo: es lo que hace que funcione la protección contra el título huérfano.
 *
 * `minPresenceAhead` se aplica en `shouldBreak`, y ahí una de las condiciones
 * es `breakingImprovesPresence`: solo corta si el elemento tiene hermanos
 * **antes** en el mismo contenedor. Con la sección envuelta en su propio
 * `View`, el título era el primer hijo, no tenía nada antes, y react-pdf
 * concluía que bajarlo de página no mejoraba nada — así que lo dejaba solo al
 * pie con sus fotos en la hoja siguiente. Sueltos en la página, el título tiene
 * detrás todo lo de las secciones anteriores y la regla se aplica.
 */
function Section({
  seccion,
  indice,
  forzarSalto,
}: {
  seccion: InformeRenderSeccion;
  indice: number;
  forzarSalto: boolean;
}) {
  const medida = MEDIDA_FOTO[seccion.fotosPorFila];
  return (
    <>
      <Text
        // El `id` es lo que después permite reconocer un título en el árbol
        // maquetado y saber si quedó solo al pie.
        id={`${ID_TITULO}${indice}`}
        style={styles.sectionTitle}
        // El salto va en el título y no en un contenedor: es el primer
        // elemento de la sección, así que empezar por él es empezar por ella.
        break={seccion.saltoDePagina || forzarSalto}
        minPresenceAhead={espacioMinimoTrasTitulo(seccion)}
      >
        {seccion.titulo.toUpperCase()}
      </Text>
      {seccion.descripcion ? (
        // `orphans`/`widows`: una sola línea suelta arriba o abajo de una hoja
        // se lee como un error de impresión, no como un párrafo.
        <Text style={styles.sectionDescription} orphans={2} widows={2}>
          {seccion.descripcion}
        </Text>
      ) : null}
      {/* Una fila por vez y `wrap={false}` en cada una: antes eran todas las
          fotos en un solo `flexWrap`, y el corte de página caía en cualquier
          lado —incluso partiendo una foto al medio—. Así una fila entera es lo
          mínimo que se mueve. */}
      {enFilas(seccion.fotos, seccion.fotosPorFila).map((fila, i) => (
        <View key={i} style={styles.photoRow} wrap={false}>
          {fila.map((foto) => (
            <Image
              key={foto.id}
              style={{
                ...styles.photo,
                width: medida.ancho,
                height: medida.alto,
              }}
              src={{
                data: Buffer.from(foto.bytes),
                format: foto.mimeType.includes("png") ? "png" : "jpg",
              }}
            />
          ))}
        </View>
      ))}
    </>
  );
}

function SignaturesBlock({ data }: { data: InformeRenderData }) {
  if (data.firmantes.length === 0) return null;
  return (
    <View style={styles.signaturesBlock} wrap={false}>
      <Text style={styles.signaturesIntro}>Atentamente,</Text>
      <View style={styles.signaturesRow}>
        {data.firmantes.map((f, i) => (
          <SignatureCell key={i} firma={f} />
        ))}
      </View>
    </View>
  );
}

function SignatureCell({ firma }: { firma: InformeRenderFirmante }) {
  return (
    <View style={styles.signatureCell}>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureName}>{firma.nombre}</Text>
      {firma.cedula ? (
        <Text style={styles.signatureCedula}>C.I. {firma.cedula}</Text>
      ) : null}
    </View>
  );
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

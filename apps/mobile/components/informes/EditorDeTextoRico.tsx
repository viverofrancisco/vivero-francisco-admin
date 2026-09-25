import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import {
  CoreBridge,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
  type BridgeState,
  type EditorBridge,
} from "@10play/tentap-editor";
import {
  COLORES_DEL_INFORME,
  CSS_DE_FUENTE,
  FUENTES_DEL_INFORME,
  NEUTROS_DEL_INFORME,
  TAMANOS_DEL_INFORME,
  VERDE_INFORME,
  fuenteDesdeCss,
} from "@vivero/shared";
import { editorHtml } from "@/editor-web/editorHtml";
import {
  PUENTES_DEL_INFORME,
  type EstadoDeFormato,
  type InstanciaDeFormato,
} from "@/components/informes/puentes";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { tema } from "@/lib/tema";

/** El editor y su estado, con lo que los puentes del informe le agregan. */
type Editor = EditorBridge & InstanciaDeFormato;
type Estado = BridgeState & EstadoDeFormato;

type Hoja = "tamano" | "fuente" | "color" | null;

/**
 * El texto como se ve en el editor del portal: el espaciado de siempre entre
 * bloques y, en una sección, la primera línea vestida de título —es lo que
 * dice que lo es—; el encabezado va centrado, como allá.
 */
function css({
  centrado,
  primeraLineaComoTitulo,
}: {
  centrado: boolean;
  primeraLineaComoTitulo: boolean;
}) {
  return `
  * { font-family: Helvetica, -apple-system, system-ui, Roboto, sans-serif; }
  body { margin: 0; color: ${tema.texto}; font-size: 16px; line-height: 1.5; }
  /* El relleno va en el documento: el contenedor de TenTap es absoluto y
     no respeta el del body. */
  .ProseMirror { outline: none; min-height: 60vh; padding: 18px 16px 56px; ${centrado ? "text-align: center;" : ""} }
  ${
    primeraLineaComoTitulo
      ? `.ProseMirror > p:first-child { text-align: center; text-transform: uppercase; color: ${VERDE_INFORME}; margin-bottom: 12px; }`
      : ""
  }
  .ProseMirror p { margin: 0 0 8px; }
  .ProseMirror ul, .ProseMirror ol { padding-left: 22px; margin: 0 0 8px; }
  .ProseMirror li + li { margin-top: 4px; }
  .ProseMirror li > p { margin: 0; }
  .ProseMirror p.is-editor-empty:first-child::before {
    color: ${tema.texto3}; content: attr(data-placeholder); float: left; height: 0; pointer-events: none;
    font-weight: 400; text-transform: none; font-size: 16px;
  }
`;
}

export interface EditorDeTextoRicoHandle {
  /** El HTML tal como está: quien lo pide decide qué hacer con él. */
  obtener: () => Promise<string>;
}

/**
 * El editor de texto rico de la app, embebible: el texto ocupa lo que le
 * den y la barra de formato va pegada al teclado. Lo usan la ficha de la
 * sección —en su pestaña *Texto*, con la primera línea vestida de título— y
 * el encabezado, centrado, como en el portal, donde son el mismo editor.
 *
 * Corre en un WebView (`@10play/tentap-editor`, Tiptap adentro) con **nuestro
 * bundle web** (`editor-web/`, compilado con `npm run editor:build`): el de
 * fábrica no trae tamaño, fuente ni alineación, y los puentes de
 * `puentes.ts` los agregan con las mismas extensiones que usa el portal, así
 * que el HTML que devuelve es el mismo —`<p>`, `<strong>`, `<em>`, `<u>`,
 * `<ul>`/`<ol>`, `<span style="font-size|font-family|color|background-color">`,
 * `text-align` en el párrafo— y el servidor lo sanea igual. La barra es
 * nuestra y no la de TenTap: la suya solo dibuja imágenes, y un tamaño o una
 * fuente se eligen en una hoja.
 *
 * La barra se ve **solo con el teclado arriba**, como la de Shopify: es
 * para escribir, y leyendo estorba. Se pone a la altura del teclado leyendo
 * sus eventos, y no con un `KeyboardAvoidingView`: ese mide su marco contra
 * el padre y el teclado contra la ventana, y con el editor debajo de una
 * cabecera y unas pestañas —o dentro de una `pageSheet`— le faltaba justo esa
 * distancia y la barra quedaba escondida detrás del teclado. El cuerpo llega
 * hasta el borde de abajo de la ventana, así que `bottom: alto del teclado`
 * es exacto en iOS; en Android la ventana se encoge sola (`adjustResize`) y
 * el fondo ya es el borde del teclado.
 */
export const EditorDeTextoRico = forwardRef<
  EditorDeTextoRicoHandle,
  {
    html: string;
    placeholder?: string;
    centrado?: boolean;
    primeraLineaComoTitulo?: boolean;
  }
>(function EditorDeTextoRico(
  { html, placeholder, centrado = false, primeraLineaComoTitulo = false },
  ref
) {
  const [hoja, setHoja] = useState<Hoja>(null);
  /** El desplegable abierto de la barra —alineación o listas— y dónde. */
  const [desplegable, setDesplegable] = useState<Desplegable | null>(null);
  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: html,
    bridgeExtensions: [
      ...TenTapStartKit,
      ...PUENTES_DEL_INFORME,
      CoreBridge.configureCSS(css({ centrado, primeraLineaComoTitulo })),
      ...(placeholder ? [PlaceholderBridge.configureExtension({ placeholder })] : []),
    ],
  }) as Editor;

  useImperativeHandle(ref, () => ({ obtener: () => editor.getHTML() }), [editor]);

  /** Cuánto mide el teclado, o cero: es lo que decide si la barra se ve y dónde. */
  const [teclado, setTeclado] = useState(0);
  useEffect(() => {
    const mostrar = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setTeclado(e.endCoordinates.height)
    );
    const ocultar = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setTeclado(0)
    );
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);

  /** Cierra la hoja y devuelve el cursor al texto, que la hoja se lo llevó. */
  function cerrarHoja() {
    setHoja(null);
    setTimeout(() => editor.focus(), 150);
  }

  return (
    <View style={styles.cuerpo}>
      <RichText
        editor={editor}
        style={styles.editor}
        // Que `focus()` desde el lado nativo levante el teclado: iOS lo
        // niega si no viene de un toque, y las hojas de abajo lo cierran.
        keyboardDisplayRequiresUserAction={false}
      />
      {/* Con un desplegable abierto, tocar en cualquier otro lado lo
          cierra: el velo va debajo de la barra y encima del texto. */}
      {desplegable ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setDesplegable(null)}
          accessibilityLabel="Cerrar el menú"
        />
      ) : null}
      {/* La barra sobre el teclado, como la de Shopify: es lo que se toca
          mientras se escribe, y abajo está el pulgar. El desplegable se
          dibuja acá y no en un `Modal`, que le quitaría el foco al texto y
          bajaría el teclado; el envoltorio deja pasar los toques por el
          hueco de arriba (`box-none`) y en Android le da al menú un padre
          que lo contenga, porque ahí un hijo fuera de su caja no recibe
          toques. */}
      {teclado > 0 ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.barraFlotante,
            styles.sobreLaBarra,
            { bottom: Platform.OS === "ios" ? teclado : 0 },
          ]}
        >
          {desplegable ? (
            <Desplegado
              editor={editor}
              desplegable={desplegable}
              onCerrar={() => setDesplegable(null)}
              centrado={centrado}
              primeraLineaComoTitulo={primeraLineaComoTitulo}
            />
          ) : null}
          <BarraDeFormato
            editor={editor}
            onAbrir={setHoja}
            desplegable={desplegable}
            onDesplegar={setDesplegable}
            centrado={centrado}
            primeraLineaComoTitulo={primeraLineaComoTitulo}
          />
        </View>
      ) : null}

      <HojaDeTamano editor={editor} visible={hoja === "tamano"} onCerrar={cerrarHoja} />
      <HojaDeFuente editor={editor} visible={hoja === "fuente"} onCerrar={cerrarHoja} />
      <HojaDeColor editor={editor} visible={hoja === "color"} onCerrar={cerrarHoja} />
    </View>
  );
});

// ───────── La barra ─────────

/** El gris de los iconos de Shopify, y el de fondo del que está activo. */
const ICONO = "#303030";

const ALINEACIONES = [
  { valor: "left", icono: "format-align-left", nombre: "Izquierda" },
  { valor: "center", icono: "format-align-center", nombre: "Centro" },
  { valor: "right", icono: "format-align-right", nombre: "Derecha" },
] as const;
type Alineacion = (typeof ALINEACIONES)[number]["valor"];

/**
 * La alineación que el lugar ya tiene sin que nadie la elija: el centro en
 * el encabezado —centrado por CSS, como en el portal— y en la primera línea
 * de una sección, que es el título y se imprime centrado; la izquierda en
 * todo lo demás. Elegirla es **quitar** la marca, y elegir otra es
 * escribirla —también la izquierda donde el centro es lo de omisión, que sin
 * la marca seguiría centrado—.
 */
function alineacionPorDefecto(
  estado: Estado,
  centrado: boolean,
  primeraLineaComoTitulo: boolean
): Alineacion {
  return centrado || (primeraLineaComoTitulo && estado.activeEnPrimerBloque)
    ? "center"
    : "left";
}

const LISTAS = [
  { valor: "bullet", icono: "format-list-bulleted", nombre: "Viñetas" },
  { valor: "ordered", icono: "format-list-numbered", nombre: "Numerada" },
] as const;

type Grupo = "alinear" | "lista";

/** Qué grupo está desplegado y dónde está su botón, en la ventana. */
interface Desplegable {
  grupo: Grupo;
  x: number;
  ancho: number;
}

/** Cuánto sube el hueco sobre la barra para que el menú tenga dónde vivir. */
const ALTO_DEL_MENU = 160;
const ANCHO_DEL_MENU = 52;

/**
 * La barra de Shopify: blanca, con una línea arriba y separadores finos
 * entre grupos. Lo que se toca siempre —negrita, cursiva, subrayado— va
 * suelto; lo que es una elección entre varias —la alineación, el tipo de
 * lista— es un botón con el valor actual y un chevron que abre un
 * **desplegable** anclado encima, con las opciones apiladas. Así la barra
 * entra en el ancho del teléfono en vez de pedir scroll para llegar al
 * final, y un menú abierto se cierra al elegir o al tocar afuera.
 */
function BarraDeFormato({
  editor,
  onAbrir,
  desplegable,
  onDesplegar,
  centrado,
  primeraLineaComoTitulo,
}: {
  editor: Editor;
  onAbrir: (hoja: Hoja) => void;
  desplegable: Desplegable | null;
  onDesplegar: (d: Desplegable | null) => void;
  centrado: boolean;
  primeraLineaComoTitulo: boolean;
}) {
  const estado = useBridgeState(editor) as Estado;
  const tamano = estado.activeFontSize ? String(parseFloat(estado.activeFontSize)) : "12";
  const alineacion =
    estado.activeTextAlign ?? alineacionPorDefecto(estado, centrado, primeraLineaComoTitulo);
  const alineacionActual =
    ALINEACIONES.find((a) => a.valor === alineacion) ?? ALINEACIONES[0];
  const listaActual = estado.isOrderedListActive ? LISTAS[1] : LISTAS[0];

  return (
    <View style={styles.barra}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.barraContenido}
      >
        <BotonDeBarra onPress={() => onAbrir("tamano")} ancho nombre="Tamaño">
          <Text style={styles.botonTexto}>{tamano} pt</Text>
        </BotonDeBarra>
        <BotonDeBarra onPress={() => onAbrir("fuente")} nombre="Fuente">
          <MaterialCommunityIcons name="format-font" size={22} color={ICONO} />
        </BotonDeBarra>
        <View style={styles.separador} />
        <BotonDeBarra
          activo={estado.isBoldActive}
          onPress={() => editor.toggleBold()}
          nombre="Negrita"
        >
          <MaterialCommunityIcons name="format-bold" size={22} color={ICONO} />
        </BotonDeBarra>
        <BotonDeBarra
          activo={estado.isItalicActive}
          onPress={() => editor.toggleItalic()}
          nombre="Cursiva"
        >
          <MaterialCommunityIcons name="format-italic" size={22} color={ICONO} />
        </BotonDeBarra>
        <BotonDeBarra
          activo={estado.isUnderlineActive}
          onPress={() => editor.toggleUnderline()}
          nombre="Subrayado"
        >
          <MaterialCommunityIcons name="format-underline" size={22} color={ICONO} />
        </BotonDeBarra>
        <BotonDeBarra onPress={() => onAbrir("color")} nombre="Color">
          <MaterialCommunityIcons name="format-color-text" size={22} color={ICONO} />
          <View
            style={[styles.muestraDeBarra, { backgroundColor: estado.activeColor ?? ICONO }]}
          />
        </BotonDeBarra>
        <View style={styles.separador} />
        <BotonDeGrupo
          grupo="alinear"
          icono={alineacionActual.icono}
          nombre="Alinear"
          desplegable={desplegable}
          onDesplegar={onDesplegar}
        />
        <View style={styles.separador} />
        <BotonDeGrupo
          grupo="lista"
          icono={listaActual.icono}
          nombre="Listas"
          desplegable={desplegable}
          onDesplegar={onDesplegar}
        />
      </ScrollView>
    </View>
  );
}

/**
 * El botón de un grupo: el icono del valor actual y un chevron. Al tocarlo
 * se mide en la ventana, que es donde el desplegable se ancla; tocarlo con
 * su menú abierto lo cierra.
 */
function BotonDeGrupo({
  grupo,
  icono,
  nombre,
  desplegable,
  onDesplegar,
}: {
  grupo: Grupo;
  icono: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  nombre: string;
  desplegable: Desplegable | null;
  onDesplegar: (d: Desplegable | null) => void;
}) {
  const ancla = useRef<View>(null);
  const abierto = desplegable?.grupo === grupo;
  return (
    <View ref={ancla} collapsable={false}>
      <BotonDeBarra
        activo={abierto}
        ancho
        nombre={nombre}
        onPress={() => {
          if (abierto) return onDesplegar(null);
          ancla.current?.measureInWindow((x, _y, ancho) =>
            onDesplegar({ grupo, x, ancho })
          );
        }}
      >
        <MaterialCommunityIcons name={icono} size={22} color={ICONO} />
        <Ionicons name="chevron-down" size={14} color={ICONO} style={styles.chevron} />
      </BotonDeBarra>
    </View>
  );
}

/** El menú anclado sobre su botón, con las opciones apiladas. */
function Desplegado({
  editor,
  desplegable,
  onCerrar,
  centrado,
  primeraLineaComoTitulo,
}: {
  editor: Editor;
  desplegable: Desplegable;
  onCerrar: () => void;
  centrado: boolean;
  primeraLineaComoTitulo: boolean;
}) {
  const estado = useBridgeState(editor) as Estado;
  const { width } = useWindowDimensions();
  const porDefecto = alineacionPorDefecto(estado, centrado, primeraLineaComoTitulo);
  const alineacion = estado.activeTextAlign ?? porDefecto;
  // Centrado bajo el botón y dentro de la pantalla.
  const left = Math.min(
    Math.max(8, desplegable.x + desplegable.ancho / 2 - ANCHO_DEL_MENU / 2),
    width - ANCHO_DEL_MENU - 8
  );
  const opciones =
    desplegable.grupo === "alinear"
      ? ALINEACIONES.map((a) => ({
          clave: a.valor,
          icono: a.icono,
          nombre: a.nombre,
          activo: alineacion === a.valor,
          onPress: () =>
            a.valor === porDefecto ? editor.unsetTextAlign() : editor.setTextAlign(a.valor),
        }))
      : [
          {
            clave: "bullet",
            icono: LISTAS[0].icono,
            nombre: LISTAS[0].nombre,
            activo: estado.isBulletListActive,
            onPress: () => editor.toggleBulletList(),
          },
          {
            clave: "ordered",
            icono: LISTAS[1].icono,
            nombre: LISTAS[1].nombre,
            activo: estado.isOrderedListActive,
            onPress: () => editor.toggleOrderedList(),
          },
        ];
  return (
    <View style={[styles.menu, { left }]}>
      {opciones.map((o) => (
        <BotonDeBarra
          key={o.clave}
          activo={o.activo}
          nombre={o.nombre}
          onPress={() => {
            o.onPress();
            onCerrar();
          }}
        >
          <MaterialCommunityIcons name={o.icono} size={22} color={ICONO} />
        </BotonDeBarra>
      ))}
    </View>
  );
}

function BotonDeBarra({
  children,
  onPress,
  activo = false,
  ancho = false,
  nombre,
}: {
  children: React.ReactNode;
  onPress: () => void;
  activo?: boolean;
  ancho?: boolean;
  nombre: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        ancho && styles.botonAncho,
        activo && styles.botonActivo,
        pressed && styles.botonTocado,
      ]}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: activo }}
    >
      {children}
    </Pressable>
  );
}

// ───────── Las hojas ─────────

function FilaDeHoja({
  texto,
  elegida,
  onPress,
  estilo,
}: {
  texto: string;
  elegida: boolean;
  onPress: () => void;
  estilo?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fila, pressed && styles.filaTocada]}
      accessibilityRole="button"
      accessibilityState={{ selected: elegida }}
    >
      <Text style={[styles.filaTexto, estilo]}>{texto}</Text>
      {elegida ? (
        <Ionicons name="checkmark" size={20} color={tema.verde} />
      ) : null}
    </Pressable>
  );
}

/** El tamaño en puntos: el número elegido es el que imprime el PDF. */
function HojaDeTamano({
  editor,
  visible,
  onCerrar,
}: {
  editor: Editor;
  visible: boolean;
  onCerrar: () => void;
}) {
  const estado = useBridgeState(editor) as Estado;
  const actual = estado.activeFontSize
    ? parseFloat(estado.activeFontSize)
    : null;
  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} maxAlto={0.85}>
      <Text style={styles.hojaTitulo}>Tamaño</Text>
      <ScrollView style={styles.hojaLista}>
        <FilaDeHoja
          texto="Como el documento"
          elegida={actual === null}
          onPress={() => {
            editor.unsetFontSize();
            onCerrar();
          }}
        />
        {TAMANOS_DEL_INFORME.map((t) => (
          <FilaDeHoja
            key={t}
            texto={`${t} pt`}
            elegida={actual === t}
            onPress={() => {
              editor.setFontSize(`${t}pt`);
              onCerrar();
            }}
          />
        ))}
      </ScrollView>
    </HojaInferior>
  );
}

/**
 * La fuente. Helvetica es la del documento, así que elegirla es quitar la
 * marca y no ponerla: el HTML queda limpio, como en el portal.
 */
function HojaDeFuente({
  editor,
  visible,
  onCerrar,
}: {
  editor: Editor;
  visible: boolean;
  onCerrar: () => void;
}) {
  const estado = useBridgeState(editor) as Estado;
  const actual = fuenteDesdeCss(estado.activeFontFamily) ?? "HELVETICA";
  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} maxAlto={0.85}>
      <Text style={styles.hojaTitulo}>Fuente</Text>
      <ScrollView style={styles.hojaLista}>
        {FUENTES_DEL_INFORME.map((f) => (
          <FilaDeHoja
            key={f.valor}
            texto={f.nombre}
            elegida={actual === f.valor}
            onPress={() => {
              if (f.valor === "HELVETICA") editor.unsetFontFamily();
              else editor.setFontFamily(CSS_DE_FUENTE[f.valor]);
              onCerrar();
            }}
          />
        ))}
      </ScrollView>
    </HojaInferior>
  );
}

// ───────── El color ─────────

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function hexDeHsv({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const canal = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/** `#abc`, `abc` o `#aabbcc` → hsv. Null si todavía no es un color. */
function hsvDeHex(texto: string | null | undefined): Hsv | null {
  if (!texto) return null;
  let t = texto.trim().replace(/^#/, "");
  if (t.length === 3) t = t.replace(/(.)/g, "$1$1");
  if (!/^[0-9a-f]{6}$/i.test(t)) return null;
  const r = parseInt(t.slice(0, 2), 16) / 255;
  const g = parseInt(t.slice(2, 4), 16) / 255;
  const b = parseInt(t.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Cuántas franjas dibujan el cuadro y la barra: un mosaico, no un degradado. */
const FRANJAS = 32;
const TONOS = 36;

/**
 * El selector de color del portal en el teléfono: el cuadro de saturación y
 * valor, la barra del tono, el campo hexadecimal y las muestras. Sin ningún
 * módulo nativo: React Native no dibuja degradados sin uno, así que el
 * cuadro son treinta y dos franjas de saturación con treinta y dos de negro
 * cada vez más opaco encima, y la barra treinta y seis tonos. De cerca se
 * ven las bandas; para elegir un color alcanza de sobra. El color se aplica
 * al soltar el dedo y al escribirlo, no en cada movimiento, que sería un
 * mensaje al editor por píxel.
 */
function SelectorDeColor({
  valor,
  onElegir,
}: {
  valor: string | undefined;
  onElegir: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState<Hsv>(
    () => hsvDeHex(valor) ?? { h: 140, s: 0.55, v: 0.45 },
  );
  const [hex, setHex] = useState(valor ?? hexDeHsv(hsv));
  const [medidas, setMedidas] = useState({ w: 1, h: 1 });
  const [altoBarra, setAltoBarra] = useState(1);

  const columnas = useMemo(
    () =>
      Array.from({ length: FRANJAS }, (_, i) =>
        hexDeHsv({ h: hsv.h, s: i / (FRANJAS - 1), v: 1 }),
      ),
    [hsv.h],
  );
  const tonos = useMemo(
    () =>
      Array.from(
        { length: TONOS },
        (_, i) => `hsl(${(i * 360) / TONOS}, 100%, 50%)`,
      ),
    [],
  );

  function mostrar(n: Hsv) {
    setHsv(n);
    setHex(hexDeHsv(n));
  }
  function aplicar(n: Hsv) {
    mostrar(n);
    onElegir(hexDeHsv(n));
  }
  const enCuadro = (x: number, y: number): Hsv => ({
    h: hsv.h,
    s: clamp01(x / medidas.w),
    v: 1 - clamp01(y / medidas.h),
  });
  const enBarra = (y: number): Hsv => ({
    ...hsv,
    h: clamp01(y / altoBarra) * 359.99,
  });

  const gestoCuadro = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => scheduleOnRN(mostrar, enCuadro(e.x, e.y)))
        .onUpdate((e) => scheduleOnRN(mostrar, enCuadro(e.x, e.y)))
        .onFinalize((e) => scheduleOnRN(aplicar, enCuadro(e.x, e.y))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hsv.h, medidas],
  );
  const gestoBarra = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => scheduleOnRN(mostrar, enBarra(e.y)))
        .onUpdate((e) => scheduleOnRN(mostrar, enBarra(e.y)))
        .onFinalize((e) => scheduleOnRN(aplicar, enBarra(e.y))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hsv.s, hsv.v, altoBarra],
  );

  function escribir(texto: string) {
    setHex(texto);
    const n = hsvDeHex(texto);
    if (n) {
      setHsv(n);
      onElegir(hexDeHsv(n));
    }
  }

  return (
    <View style={styles.selector}>
      <View style={styles.cuadroYBarra}>
        <GestureDetector gesture={gestoCuadro}>
          <View
            style={styles.cuadro}
            onLayout={(e) =>
              setMedidas({
                w: e.nativeEvent.layout.width,
                h: e.nativeEvent.layout.height,
              })
            }
          >
            <View style={styles.franjas}>
              {columnas.map((c, i) => (
                <View key={i} style={[styles.franja, { backgroundColor: c }]} />
              ))}
            </View>
            <View style={StyleSheet.absoluteFill}>
              {Array.from({ length: FRANJAS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.franja,
                    { backgroundColor: `rgba(0,0,0,${i / (FRANJAS - 1)})` },
                  ]}
                />
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.perilla,
                {
                  left: hsv.s * medidas.w - 10,
                  top: (1 - hsv.v) * medidas.h - 10,
                  backgroundColor: hexDeHsv(hsv),
                },
              ]}
            />
          </View>
        </GestureDetector>
        <GestureDetector gesture={gestoBarra}>
          <View
            style={styles.barraDeTono}
            onLayout={(e) => setAltoBarra(e.nativeEvent.layout.height)}
          >
            <View style={styles.franjasVerticales}>
              {tonos.map((c, i) => (
                <View key={i} style={[styles.franja, { backgroundColor: c }]} />
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.perilla,
                styles.perillaDeTono,
                {
                  top: (hsv.h / 360) * altoBarra - 10,
                  backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                },
              ]}
            />
          </View>
        </GestureDetector>
      </View>
      <View style={styles.filaHex}>
        <View
          style={[styles.vistaDeColor, { backgroundColor: hexDeHsv(hsv) }]}
        />
        <TextInput
          value={hex}
          onChangeText={escribir}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          placeholder="#000000"
          placeholderTextColor={tema.texto3}
          style={styles.campoHex}
          accessibilityLabel="Color en hexadecimal"
        />
      </View>
    </View>
  );
}

/**
 * El color del texto o el de su fondo, en dos pestañas: el selector, las
 * muestras del portal y *Sin color*. El selector se remonta al cambiar de
 * pestaña (`key`), porque cada una arranca de su propio color.
 */
function HojaDeColor({
  editor,
  visible,
  onCerrar,
}: {
  editor: Editor;
  visible: boolean;
  onCerrar: () => void;
}) {
  const estado = useBridgeState(editor) as Estado;
  const [pestana, setPestana] = useState<"texto" | "fondo">("texto");
  const actual =
    pestana === "texto" ? estado.activeColor : estado.activeBackgroundColor;
  const poner = (color: string | null) => {
    if (pestana === "texto") {
      if (color) editor.setColor(color);
      else editor.unsetColor();
    } else if (color) editor.setBackgroundColor(color);
    else editor.unsetBackgroundColor();
  };
  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} maxAlto={0.9}>
      <View style={styles.pestanas}>
        {(["texto", "fondo"] as const).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPestana(p)}
            style={[styles.pestana, pestana === p && styles.pestanaActiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
          >
            <Text
              style={[
                styles.pestanaTexto,
                pestana === p && styles.pestanaTextoActivo,
              ]}
            >
              {p === "texto" ? "Texto" : "Fondo"}
            </Text>
          </Pressable>
        ))}
      </View>
      <SelectorDeColor key={pestana} valor={actual} onElegir={poner} />
      {[COLORES_DEL_INFORME, NEUTROS_DEL_INFORME].map((fila, i) => (
        <View key={i} style={styles.muestras}>
          {fila.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                poner(c);
                onCerrar();
              }}
              style={[
                styles.muestra,
                { backgroundColor: c },
                actual?.toLowerCase() === c.toLowerCase() &&
                  styles.muestraElegida,
              ]}
              accessibilityRole="button"
              accessibilityLabel={c}
            />
          ))}
        </View>
      ))}
      <FilaDeHoja
        texto="Sin color"
        elegida={!actual}
        onPress={() => {
          poner(null);
          onCerrar();
        }}
      />
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flex: 1, backgroundColor: tema.superficie },
  editor: { flex: 1, backgroundColor: tema.superficie },
  barraFlotante: { position: "absolute", width: "100%", bottom: 0 },
  barra: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d9d9d9",
  },
  barraContenido: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minWidth: "100%",
  },
  boton: {
    flexDirection: "row",
    minWidth: 38,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  botonAncho: { paddingHorizontal: 8 },
  // El cuadrado gris de Shopify, con su borde apenas visible.
  botonActivo: {
    backgroundColor: "#f1f1f1",
    borderWidth: 1,
    borderColor: "#e3e3e3",
  },
  botonTocado: { opacity: 0.6 },
  botonTexto: { fontSize: 13, fontWeight: "600", color: ICONO },
  chevron: { marginLeft: 2 },
  sobreLaBarra: { paddingTop: ALTO_DEL_MENU },
  // La tarjeta de Shopify: blanca, redondeada, con sombra, las opciones una
  // debajo de la otra, y pegada a la barra.
  menu: {
    position: "absolute",
    bottom: 58,
    width: ANCHO_DEL_MENU,
    padding: 6,
    gap: 2,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  separador: {
    width: 1,
    height: 24,
    backgroundColor: "#e3e3e3",
    marginHorizontal: 4,
  },
  muestraDeBarra: {
    position: "absolute",
    bottom: 5,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
  },
  hojaTitulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  hojaLista: { flexGrow: 0 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  filaTocada: { backgroundColor: tema.lienzo },
  filaTexto: { fontSize: 16, color: tema.texto },
  pestanas: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  pestana: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: tema.lienzo,
  },
  pestanaActiva: { backgroundColor: tema.verde100 },
  pestanaTexto: { fontSize: 14, fontWeight: "600", color: tema.texto2 },
  pestanaTextoActivo: { color: tema.verde700 },
  muestras: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  muestra: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  muestraElegida: { borderWidth: 3, borderColor: tema.verde },
  selector: { paddingHorizontal: 4, paddingBottom: 12, gap: 12 },
  // El cuadro y, a su derecha, la barra del tono de pie: la forma de Shopify.
  cuadroYBarra: { flexDirection: "row", gap: 12, height: 180 },
  cuadro: { flex: 1, borderRadius: 10, overflow: "hidden" },
  barraDeTono: { width: 28, borderRadius: 14, overflow: "hidden" },
  franjas: { flex: 1, flexDirection: "row" },
  franjasVerticales: { flex: 1, flexDirection: "column" },
  franja: { flex: 1 },
  perilla: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  perillaDeTono: { left: 4 },
  filaHex: { flexDirection: "row", alignItems: "center", gap: 10 },
  vistaDeColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tema.linea,
  },
  campoHex: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    paddingHorizontal: 12,
    fontSize: 15,
    color: tema.texto,
    backgroundColor: tema.superficie,
  },
});

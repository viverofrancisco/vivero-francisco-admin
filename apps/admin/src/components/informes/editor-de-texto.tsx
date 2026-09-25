"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BackgroundColor,
  Color,
  FontFamily,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  COLORES_DEL_INFORME as COLORES,
  HOJA_DE_FUENTES_DEL_INFORME as HOJA_DE_FUENTES,
  NEUTROS_DEL_INFORME as NEUTROS,
  TAMANOS_DEL_INFORME as TAMANOS,
} from "@vivero/shared";
import {
  CSS_DE_FUENTE,
  FUENTES_DEL_INFORME,
  fuenteDesdeCss,
  type FuenteDelInforme,
} from "@/lib/informes/encabezado";

/**
 * Los tamaños de siempre, en puntos —el PDF mide así—, como atajo. No son un
 * límite: al lado se escribe cualquier otro.
 */

/** Hasta dónde tiene sentido: 6 pt no se lee y 96 no entra en la hoja. */
const TAMANO_MINIMO = 6;
const TAMANO_MAXIMO = 96;

/** Los dos colores del documento primero, y después una fila de neutros. */

const ALINEACIONES = [
  { valor: "left", nombre: "Izquierda", Icono: AlignLeft },
  { valor: "center", nombre: "Centro", Icono: AlignCenter },
  { valor: "right", nombre: "Derecha", Icono: AlignRight },
] as const;

/**
 * Las fuentes que se ofrecen: las que el PDF puede imprimir. Helvetica es la
 * del documento, así que elegirla es quitar la marca y no ponerla — el HTML
 * queda limpio y un texto sin más formato sigue guardándose plano.
 */
const FUENTES = FUENTES_DEL_INFORME;

/**
 * Las embarcadas, para que el editor las dibuje como el PDF: el navegador no
 * las tiene, así que se piden a Google Fonts. Con las cuatro caras que el
 * informe usa. React 19 sube el `<link>` al `<head>` y lo deduplica por href.
 */

type Marca = "negrita" | "cursiva" | "subrayado";
const TODAS_LAS_MARCAS: Marca[] = ["negrita", "cursiva", "subrayado"];

/**
 * El editor de lo que se imprime en el informe: el encabezado, y el título y
 * la descripción de cada sección.
 *
 * Empezó como el editor del encabezado. Cada pedazo lleva su tamaño, su color
 * y sus marcas; Enter corta la línea; y desde que las secciones se escriben
 * con él, también hace listas —con viñetas o numeradas—, que es lo que una
 * descripción de trabajos suele ser.
 *
 * **Los tamaños van en puntos**, que es la unidad del PDF: lo que se elige acá
 * es literalmente lo que se imprime, sin conversiones en el medio.
 *
 * `value` es el contenido **inicial**: el editor es dueño del texto mientras
 * está montado, y lo que cambia sale por `onChange`.
 */
export function EditorDeTextoRico({
  value,
  onChange,
  className,
  alineacion = "left",
  alto = "min-h-24",
  placeholder,
  listas = false,
  marcas = TODAS_LAS_MARCAS,
  primeraLineaComoTitulo = false,
  altoMaximo = "max-h-96",
  llenar = false,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  /** Cómo va cada párrafo si no se dice otra cosa. */
  alineacion?: "left" | "center";
  /** La clase de alto mínimo del área de texto. */
  alto?: string;
  placeholder?: string;
  /** Con viñetas y numeración en la barra. */
  listas?: boolean;
  /**
   * Qué marcas ofrece la barra. El título de una sección se imprime siempre
   * en negrita y subrayado, así que ahí esos dos botones sobran.
   */
  marcas?: Marca[];
  /**
   * La primera línea se ve como el título de una sección —centrada, en
   * negrita, subrayada, verde y en mayúsculas—, que es como la imprime el
   * PDF: así se ve en el editor lo que el campo es, un título y su
   * descripción, sin un segundo campo.
   */
  primeraLineaComoTitulo?: boolean;
  /**
   * La clase de alto máximo del área de texto: pasado eso, el texto scrollea
   * adentro y la barra se queda arriba. Sin tope, una descripción larga
   * empujaba las fotos fuera de la pantalla.
   */
  altoMaximo?: string;
  /**
   * Ocupar todo el alto del contenedor —el panel de la sección— en vez de
   * crecer con el texto: la barra arriba, y el área de texto con lo que
   * queda, scrolleando adentro. Con esto `alto` y `altoMaximo` no cuentan.
   */
  llenar?: boolean;
}) {
  /** Lo tipeado en el campo de tamaño, y con qué valor del editor se tipeó. */
  const [tamano, setTamano] = useState({ valor: "12", delEditor: 12 });
  /** Qué se está pintando en el menú de color: la letra o lo de atrás. */
  const [pestana, setPestana] = useState<"texto" | "fondo">("texto");

  const editor = useEditor({
    // Se pinta en el cliente: en el servidor no hay `document` y Tiptap lo
    // avisa con un error de hidratación si no se lo dice.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Son líneas sueltas: no hay jerarquía que marcar, y el tamaño se
        // elige a mano. Todo lo demás sobra y sería una etiqueta más que
        // traducir al PDF.
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: listas ? undefined : false,
        orderedList: listas ? undefined : false,
        listItem: listas ? undefined : false,
        strike: false,
        code: false,
        link: false,
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      FontFamily,
      // **Sin `defaultAlignment`.** En Tiptap 3 `renderHTML` escribe el
      // `style="text-align: …"` siempre que el atributo tenga valor, el de
      // omisión incluido: con "left" de omisión, cada párrafo salía del editor
      // —y del `getHTML()` que se guarda— con `text-align: left` puesto, así
      // que un título quedaba a la izquierda en el PDF apenas se tocaba algo,
      // y ningún texto volvía a ser plano. Con `null` el estilo viaja solo
      // cuando alguien eligió una alineación; la de omisión la pone el CSS de
      // abajo, y en el PDF la del lugar.
      TextAlign.configure({
        types: ["paragraph"],
        defaultAlignment: null,
      }),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: [
          // Medio cuerpo entre bloques —párrafos y listas— y un cuarto entre
          // ítems: es la separación que el PDF copia, así lo que se ve al
          // escribir es lo que sale. Un párrafo vacío mide un renglón.
          "px-3 py-3 leading-snug focus:outline-none [&_p]:min-h-[1em] [&>*+*]:mt-2",
          // Llenando, el área mide lo que el contenedor: un clic en cualquier
          // parte del blanco pone el cursor.
          llenar ? "min-h-full" : alto,
          alineacion === "center" ? "text-center" : "text-left",
          // Tailwind quita las viñetas de todas las listas; acá se ven, que
          // es lo que se está eligiendo.
          "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li>p]:mt-0 [&_li+li]:mt-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1",
          primeraLineaComoTitulo
            ? "[&>p:first-child]:text-center [&>p:first-child]:uppercase [&>p:first-child]:text-[#226633] [&>p:first-child]:mb-1"
            : "",
        ].join(" "),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  /**
   * Lo que la barra necesita saber del cursor.
   *
   * Va por `useEditorState` y no leyendo `editor.getAttributes(...)` en el
   * render: `useEditor` **no vuelve a dibujar el componente cuando solo se
   * mueve la selección**, así que la barra se quedaba con lo del cursor
   * anterior —hacías clic en una línea de 12 pt y el campo seguía diciendo 14,
   * y lo mismo el color y la negrita—. Esto se suscribe a estos valores y
   * redibuja cuando cambian.
   */
  const estado = useEditorState({
    editor,
    selector: ({ editor }) => ({
      negrita: editor?.isActive("bold") ?? false,
      cursiva: editor?.isActive("italic") ?? false,
      subrayado: editor?.isActive("underline") ?? false,
      vinetas: editor?.isActive("bulletList") ?? false,
      numerada: editor?.isActive("orderedList") ?? false,
      tamano:
        (editor?.getAttributes("textStyle").fontSize as string | undefined) ??
        null,
      fuente:
        (editor?.getAttributes("textStyle").fontFamily as string | undefined) ??
        null,
      color:
        (editor?.getAttributes("textStyle").color as string | undefined) ??
        null,
      fondo:
        (editor?.getAttributes("textStyle").backgroundColor as
          | string
          | undefined) ?? null,
      alineacion:
        (["left", "center", "right"] as const).find((a) =>
          editor?.isActive({ textAlign: a })
        ) ?? alineacion,
    }),
  });

  if (!editor || !estado) {
    // El alto del editor ya montado, para que no salte al aparecer.
    return (
      <div
        className={`${llenar ? "h-full" : alto} rounded-lg border bg-transparent ${className ?? ""}`}
      />
    );
  }

  const boton = (
    activo: boolean,
    etiqueta: string,
    onClick: () => void,
    icono: React.ReactNode
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      className={activo ? "bg-muted text-foreground" : ""}
      onClick={onClick}
    >
      {icono}
    </Button>
  );

  // El tamaño, el color y la alineación donde está el cursor. Sin marca, los
  // que trae el documento.
  const delEditor =
    Number(String(estado.tamano ?? "").replace(/[^\d.]/g, "")) || 12;
  const fuenteActual =
    (estado.fuente && fuenteDesdeCss(estado.fuente)) || "HELVETICA";
  const elegirFuente = (fuente: FuenteDelInforme) => {
    const cadena = editor.chain().focus();
    if (fuente === "HELVETICA") cadena.unsetFontFamily().run();
    else cadena.setFontFamily(CSS_DE_FUENTE[fuente]).run();
  };
  const colorActual = estado.color ?? undefined;
  const fondoActual = estado.fondo ?? undefined;
  const deTexto = pestana === "texto";
  const colorDePestana = deTexto ? colorActual : fondoActual;
  const alineacionActual =
    ALINEACIONES.find((a) => a.valor === estado.alineacion) ??
    ALINEACIONES[alineacion === "center" ? 1 : 0];

  // Lo que se ve en el campo mientras se escribe. Cuando el cursor se mueve a
  // un texto de otro tamaño, el campo lo sigue —de ahí el `delEditor` guardado:
  // distingue "cambió el cursor" de "está tipeando".
  const escrito =
    tamano.delEditor === delEditor ? tamano.valor : String(delEditor);

  const aplicarTamano = (valor: string | number) => {
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n) || n < TAMANO_MINIMO || n > TAMANO_MAXIMO) {
      // Fuera de rango o sin número: el campo vuelve a lo que hay puesto.
      setTamano({ valor: String(delEditor), delEditor });
      return;
    }
    setTamano({ valor: String(n), delEditor: n });
    editor.chain().focus().setFontSize(`${n}pt`).run();
  };

  const pintar = (hex: string) => {
    const cadena = editor.chain().focus();
    if (deTexto) cadena.setColor(hex).run();
    else cadena.setBackgroundColor(hex).run();
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${
        llenar ? "flex h-full min-h-0 flex-col" : ""
      } ${className ?? ""}`}
    >
      <link rel="stylesheet" precedence="default" href={HOJA_DE_FUENTES} />
      <div className="flex flex-none flex-wrap items-center gap-1 border-b bg-muted/30 px-1.5 py-1">
        {/* Se escribe el tamaño, o se elige uno de los de siempre. Un
            desplegable a secas obliga a que el que uno quiere esté en la
            lista, y en un encabezado se afina hasta que la línea entra. */}
        <div className="flex h-8 items-center rounded-md border bg-background">
          <input
            type="number"
            min={TAMANO_MINIMO}
            max={TAMANO_MAXIMO}
            value={escrito}
            aria-label="Tamaño en puntos"
            onChange={(e) => setTamano({ valor: e.target.value, delEditor })}
            // Se aplica al salir o con Enter, no en cada tecla: tipear "16"
            // pasa por "1", y un renglón de 1 pt es un parpadeo feo.
            onBlur={() => aplicarTamano(escrito)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarTamano(escrito);
              }
            }}
            className="h-full w-11 bg-transparent pl-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="pr-1 text-xs text-muted-foreground">pt</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Tamaños frecuentes"
                  className="h-full rounded-l-none"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            {/* Cada uno dibujado a su tamaño: se elige mirando, no calculando. */}
            <DropdownMenuContent align="start" className="min-w-32">
              {TAMANOS.map((t) => (
                <DropdownMenuItem key={t} onClick={() => aplicarTamano(t)}>
                  <span style={{ fontSize: `${Math.min(t, 20)}pt` }}>
                    {t} pt
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* La fuente, después del tamaño: las tres del PDF, cada una dibujada
            en la suya para elegir mirando. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Fuente"
                title="Fuente"
                className="gap-1 px-2"
              />
            }
          >
            <span
              className="max-w-28 truncate text-xs"
              style={{ fontFamily: CSS_DE_FUENTE[fuenteActual] }}
            >
              {FUENTES.find((f) => f.valor === fuenteActual)?.nombre}
            </span>
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {FUENTES.map((f) => (
              <DropdownMenuItem
                key={f.valor}
                onClick={() => elegirFuente(f.valor)}
                className={fuenteActual === f.valor ? "bg-muted" : undefined}
              >
                <span style={{ fontFamily: CSS_DE_FUENTE[f.valor] }}>
                  {f.nombre}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {marcas.length > 0 && <span className="mx-1 h-4 w-px bg-border" />}

        {marcas.includes("negrita") &&
          boton(
            estado.negrita,
            "Negrita",
            () => editor.chain().focus().toggleBold().run(),
            <Bold />
          )}
        {marcas.includes("cursiva") &&
          boton(
            estado.cursiva,
            "Cursiva",
            () => editor.chain().focus().toggleItalic().run(),
            <Italic />
          )}
        {marcas.includes("subrayado") &&
          boton(
            estado.subrayado,
            "Subrayado",
            () => editor.chain().focus().toggleUnderline().run(),
            <UnderlineIcon />
          )}

        <span className="mx-1 h-4 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Color del texto"
                title="Color del texto"
                className="gap-1.5 px-2"
              />
            }
          >
            <span
              className="text-sm font-semibold leading-none"
              style={{
                color: aHex(colorActual) ?? undefined,
                backgroundColor: aHex(fondoActual) ?? undefined,
              }}
            >
              A
            </span>
            <span
              className="h-3 w-4 rounded-[2px] border"
              style={{ backgroundColor: aHex(colorActual) ?? "#222222" }}
            />
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto space-y-2 p-2">
            {/* La letra o lo de atrás: dos cosas distintas sobre la misma
                selección, así que comparten el selector y cambian de pestaña. */}
            <div className="flex border-b">
              {(["texto", "fondo"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPestana(p)}
                  className={`flex-1 px-3 py-1.5 text-sm capitalize transition-colors ${
                    pestana === p
                      ? "border-b-2 border-foreground font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <ColorPicker
              value={aHex(colorDePestana) ?? (deTexto ? "#222222" : "#ffffff")}
              onChange={pintar}
              muestras={COLORES}
              neutros={NEUTROS}
            />
            {colorDePestana ? (
              <button
                type="button"
                onClick={() => {
                  const cadena = editor.chain().focus();
                  if (deTexto) cadena.unsetColor().run();
                  else cadena.unsetBackgroundColor().run();
                }}
                className="w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Quitar el color
              </button>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Alineación"
                title="Alineación"
                className="gap-1 px-2"
              />
            }
          >
            <alineacionActual.Icono className="size-4" />
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            {ALINEACIONES.map(({ valor, nombre, Icono }) => (
              <DropdownMenuItem
                key={valor}
                onClick={() => editor.chain().focus().setTextAlign(valor).run()}
                className={
                  alineacionActual.valor === valor ? "bg-muted" : undefined
                }
              >
                <Icono className="size-4" />
                {nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Listas: con viñetas o numeradas. Un botón cada una, que se prende
            mientras el cursor está adentro; apretarlo de nuevo la deshace. */}
        {listas && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            {boton(
              estado.vinetas,
              "Lista con viñetas",
              () => editor.chain().focus().toggleBulletList().run(),
              <List />
            )}
            {boton(
              estado.numerada,
              "Lista numerada",
              () => editor.chain().focus().toggleOrderedList().run(),
              <ListOrdered />
            )}
          </>
        )}
      </div>
      {/* Lo que scrollea es el área de texto, no el editor entero: así la
          barra de formato queda a la vista mientras se baja por un texto
          largo. */}
      <EditorContent
        editor={editor}
        className={`overflow-y-auto overscroll-contain ${
          llenar ? "min-h-0 flex-1" : altoMaximo
        }`}
      />
    </div>
  );
}

/**
 * El color como `#rrggbb`, que es lo único que entiende `input[type=color]`.
 *
 * El navegador normaliza lo que escribe el editor a `rgb(...)`, así que hay que
 * volver: sin esto el selector abre siempre en negro aunque el texto sea verde.
 */
function aHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  if (color.startsWith("#")) return color.slice(0, 7);
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (!m) return undefined;
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

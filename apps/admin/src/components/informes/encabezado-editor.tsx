"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BackgroundColor,
  Color,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
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
import { AZUL_INFORME, VERDE_INFORME } from "@/lib/informes/encabezado-texto";

/**
 * Los tamaños de siempre, en puntos —el PDF mide así—, como atajo. No son un
 * límite: al lado se escribe cualquier otro.
 */
const TAMANOS = [10, 11, 12, 14, 16, 18, 20, 24];

/** Hasta dónde tiene sentido: 6 pt no se lee y 96 no entra en la hoja. */
const TAMANO_MINIMO = 6;
const TAMANO_MAXIMO = 96;

/** Los dos colores del documento primero, y después una fila de neutros. */
const COLORES = [
  VERDE_INFORME,
  AZUL_INFORME,
  "#a11212",
  "#b45309",
  "#b8a300",
  "#0f766e",
  "#6b21a8",
];
const NEUTROS = [
  "#222222",
  "#555555",
  "#888888",
  "#b5b5b5",
  "#d9d9d9",
  "#f2f2f2",
  "#ffffff",
];

const ALINEACIONES = [
  { valor: "left", nombre: "Izquierda", Icono: AlignLeft },
  { valor: "center", nombre: "Centro", Icono: AlignCenter },
  { valor: "right", nombre: "Derecha", Icono: AlignRight },
] as const;

/**
 * El encabezado del informe: lo que sale impreso arriba de todo.
 *
 * Antes era un campo de una línea —el título— y una segunda línea que el PDF
 * armaba solo. Un nombre largo se partía a mitad de palabra y no había dónde
 * meter el corte. Acá se escribe entero: Enter corta la línea, y cada pedazo
 * lleva su tamaño, su color, su alineación y sus marcas.
 *
 * **Los tamaños van en puntos**, que es la unidad del PDF: lo que se elige acá
 * es literalmente lo que se imprime, sin conversiones en el medio.
 */
export function EncabezadoEditor({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
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
        // Un encabezado son líneas sueltas: no hay jerarquía que marcar, y el
        // tamaño se elige a mano. Todo lo demás sobra y sería una etiqueta más
        // que traducir al PDF.
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        strike: false,
        code: false,
        link: false,
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      TextAlign.configure({ types: ["paragraph"], defaultAlignment: "center" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          // Alto para unas cinco líneas: un encabezado de tres renglones
          // entraba justo y no quedaba lugar para ver lo que se escribe.
          "min-h-44 px-3 py-3 text-center leading-snug focus:outline-none [&_p]:min-h-[1em] [&_p+p]:mt-2",
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
      tamano:
        (editor?.getAttributes("textStyle").fontSize as string | undefined) ??
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
        ) ?? "center",
    }),
  });

  if (!editor || !estado) {
    // El alto del editor ya montado, para que no salte al aparecer.
    return (
      <div
        className={`min-h-56 rounded-lg border bg-transparent ${className ?? ""}`}
      />
    );
  }

  const marca = (
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
  const colorActual = estado.color ?? undefined;
  const fondoActual = estado.fondo ?? undefined;
  const deTexto = pestana === "texto";
  const colorDePestana = deTexto ? colorActual : fondoActual;
  const alineacionActual =
    ALINEACIONES.find((a) => a.valor === estado.alineacion) ?? ALINEACIONES[1];

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
      className={`overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-1.5 py-1">
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

        <span className="mx-1 h-4 w-px bg-border" />

        {marca(
          estado.negrita,
          "Negrita",
          () => editor.chain().focus().toggleBold().run(),
          <Bold />
        )}
        {marca(
          estado.cursiva,
          "Cursiva",
          () => editor.chain().focus().toggleItalic().run(),
          <Italic />
        )}
        {marca(
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
      </div>
      <EditorContent editor={editor} />
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

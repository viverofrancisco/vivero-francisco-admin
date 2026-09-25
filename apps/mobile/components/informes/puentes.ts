import { BridgeExtension } from "@10play/tentap-editor";
import {
  BackgroundColor,
  FontFamily,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";

/**
 * Los puentes que le faltan al editor de fábrica para escribir lo mismo que
 * el del portal: tamaño, fuente, color de fondo y alineación. Un puente es
 * una extensión de Tiptap del lado del WebView más los mensajes con que el
 * lado nativo la maneja y el estado que devuelve; este archivo lo importan
 * **los dos lados** —la app y el bundle web de `editor-web/`—, por eso no
 * tiene nada de React Native.
 *
 * Son las mismas extensiones que usa el portal (`@tiptap/extension-text-style`
 * y `text-align`), así que el HTML sale igual: `font-size: 14pt`,
 * `font-family`, `background-color` en un `<span style>` y `text-align` en el
 * párrafo. Y `TextAlign` va **sin `defaultAlignment`**, como allá: con uno,
 * cada párrafo salía con `text-align: left` al tocarlo y ningún texto volvía
 * a ser plano.
 */

export interface EstadoDeFormato {
  activeFontSize: string | undefined;
  activeFontFamily: string | undefined;
  activeBackgroundColor: string | undefined;
  activeTextAlign: string | undefined;
  /**
   * Si el cursor está en el primer bloque del documento: en una sección ese
   * es el título, que se imprime centrado, así que su alineación por
   * omisión no es la del resto.
   */
  activeEnPrimerBloque: boolean;
}

export interface InstanciaDeFormato {
  setFontSize: (tamano: string) => void;
  unsetFontSize: () => void;
  setFontFamily: (familia: string) => void;
  unsetFontFamily: () => void;
  setBackgroundColor: (color: string) => void;
  unsetBackgroundColor: () => void;
  setTextAlign: (alineacion: string) => void;
  unsetTextAlign: () => void;
}

type Mensaje =
  | { type: "set-font-size"; payload: string }
  | { type: "unset-font-size"; payload: undefined }
  | { type: "set-font-family"; payload: string }
  | { type: "unset-font-family"; payload: undefined }
  | { type: "set-background-color"; payload: string }
  | { type: "unset-background-color"; payload: undefined }
  | { type: "set-text-align"; payload: string }
  | { type: "unset-text-align"; payload: undefined };

export const FontSizeBridge = new BridgeExtension<
  Pick<EstadoDeFormato, "activeFontSize">,
  Pick<InstanciaDeFormato, "setFontSize" | "unsetFontSize">,
  Mensaje
>({
  tiptapExtension: FontSize,
  tiptapExtensionDeps: [TextStyle],
  onBridgeMessage: (editor, { type, payload }) => {
    if (type === "set-font-size") editor.chain().focus().setFontSize(payload).run();
    if (type === "unset-font-size") editor.chain().focus().unsetFontSize().run();
    return false;
  },
  extendEditorInstance: (enviar) => ({
    setFontSize: (tamano) => enviar({ type: "set-font-size", payload: tamano }),
    unsetFontSize: () => enviar({ type: "unset-font-size", payload: undefined }),
  }),
  extendEditorState: (editor) => ({
    activeFontSize: editor.getAttributes("textStyle").fontSize,
  }),
});

export const FontFamilyBridge = new BridgeExtension<
  Pick<EstadoDeFormato, "activeFontFamily">,
  Pick<InstanciaDeFormato, "setFontFamily" | "unsetFontFamily">,
  Mensaje
>({
  tiptapExtension: FontFamily,
  onBridgeMessage: (editor, { type, payload }) => {
    if (type === "set-font-family") editor.chain().focus().setFontFamily(payload).run();
    if (type === "unset-font-family") editor.chain().focus().unsetFontFamily().run();
    return false;
  },
  extendEditorInstance: (enviar) => ({
    setFontFamily: (familia) => enviar({ type: "set-font-family", payload: familia }),
    unsetFontFamily: () => enviar({ type: "unset-font-family", payload: undefined }),
  }),
  extendEditorState: (editor) => ({
    activeFontFamily: editor.getAttributes("textStyle").fontFamily,
  }),
});

export const BackgroundColorBridge = new BridgeExtension<
  Pick<EstadoDeFormato, "activeBackgroundColor">,
  Pick<InstanciaDeFormato, "setBackgroundColor" | "unsetBackgroundColor">,
  Mensaje
>({
  tiptapExtension: BackgroundColor,
  onBridgeMessage: (editor, { type, payload }) => {
    if (type === "set-background-color")
      editor.chain().focus().setBackgroundColor(payload).run();
    if (type === "unset-background-color")
      editor.chain().focus().unsetBackgroundColor().run();
    return false;
  },
  extendEditorInstance: (enviar) => ({
    setBackgroundColor: (color) =>
      enviar({ type: "set-background-color", payload: color }),
    unsetBackgroundColor: () =>
      enviar({ type: "unset-background-color", payload: undefined }),
  }),
  extendEditorState: (editor) => ({
    activeBackgroundColor: editor.getAttributes("textStyle").backgroundColor,
  }),
});

export const TextAlignBridge = new BridgeExtension<
  Pick<EstadoDeFormato, "activeTextAlign" | "activeEnPrimerBloque">,
  Pick<InstanciaDeFormato, "setTextAlign" | "unsetTextAlign">,
  Mensaje
>({
  tiptapExtension: TextAlign.configure({
    types: ["paragraph"],
    // Ver arriba: sin alineación por omisión, o nada vuelve a ser plano.
    defaultAlignment: null as unknown as string,
  }),
  onBridgeMessage: (editor, { type, payload }) => {
    if (type === "set-text-align") editor.chain().focus().setTextAlign(payload).run();
    if (type === "unset-text-align") editor.chain().focus().unsetTextAlign().run();
    return false;
  },
  extendEditorInstance: (enviar) => ({
    setTextAlign: (alineacion) => enviar({ type: "set-text-align", payload: alineacion }),
    unsetTextAlign: () => enviar({ type: "unset-text-align", payload: undefined }),
  }),
  extendEditorState: (editor) => ({
    activeTextAlign: editor.getAttributes("paragraph").textAlign,
    // `index(0)`: en qué hijo del documento cae la posición.
    activeEnPrimerBloque: editor.state.selection.$from.index(0) === 0,
  }),
});

/** Los cuatro, en el orden en que se registran. */
export const PUENTES_DEL_INFORME = [
  FontSizeBridge,
  FontFamilyBridge,
  BackgroundColorBridge,
  TextAlignBridge,
];

import React from "react";
import { EditorContent } from "@tiptap/react";
import { TenTapStartKit, useTenTap } from "@10play/tentap-editor";
import { PUENTES_DEL_INFORME } from "../components/informes/puentes";

/**
 * El lado web del editor de la app: el kit de TenTap más los puentes del
 * informe. Se compila con Vite a un solo HTML (`npm run editor:build`) que
 * la app carga en su WebView como `customSource`; el de fábrica no trae
 * tamaño, fuente ni alineación, y esas se piden desde el teléfono.
 */
export function Editor() {
  const editor = useTenTap({ bridges: [...TenTapStartKit, ...PUENTES_DEL_INFORME] });
  return (
    <EditorContent
      editor={editor}
      className={window.dynamicHeight ? "dynamic-height" : undefined}
    />
  );
}

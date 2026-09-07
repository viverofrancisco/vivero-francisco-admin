"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Un editor de texto con formato.
 *
 * Guarda **HTML**, y lo que puede producir está acotado por el esquema del
 * editor: negrita, cursiva, listas, títulos y párrafos. No hay forma de tipear
 * un `<script>` acá — pero el cuerpo de un PUT sí podría traerlo, así que el
 * servidor vuelve a limpiarlo antes de guardar (`sanitizarHtml`). La regla es
 * la de siempre: lo que valida la pantalla no cuenta.
 *
 * Vacío guarda vacío y no `<p></p>`: un párrafo con nada adentro se vería como
 * "hay descripción" en todas las listas que preguntan si la hay.
 */
export function RichText({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    // El contenido se pinta en el cliente: en el servidor no hay `document` y
    // Tiptap lo avisa con un error de hidratación si no se lo dice.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Nada de esto tiene sentido en la descripción de un producto, y cada
        // uno es una etiqueta más que sanear del otro lado.
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-28 px-3 py-2 focus:outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5",
      },
    },
    onUpdate: ({ editor }) =>
      onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  if (!editor) {
    // El alto del editor ya montado, para que no salte al aparecer.
    return (
      <div className={`min-h-40 rounded-lg border bg-transparent ${className ?? ""}`} />
    );
  }

  const boton = (
    activo: boolean,
    etiqueta: string,
    onClick: () => void,
    icono: React.ReactNode,
    deshabilitado = false
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={etiqueta}
      aria-pressed={activo}
      disabled={deshabilitado}
      className={activo ? "bg-muted text-foreground" : ""}
      onClick={onClick}
    >
      {icono}
    </Button>
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
        {boton(
          editor.isActive("bold"),
          "Negrita",
          () => editor.chain().focus().toggleBold().run(),
          <Bold />
        )}
        {boton(
          editor.isActive("italic"),
          "Cursiva",
          () => editor.chain().focus().toggleItalic().run(),
          <Italic />
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        {boton(
          editor.isActive("heading", { level: 3 }),
          "Título",
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          <span className="text-xs font-semibold">H</span>
        )}
        {boton(
          editor.isActive("bulletList"),
          "Lista",
          () => editor.chain().focus().toggleBulletList().run(),
          <List />
        )}
        {boton(
          editor.isActive("orderedList"),
          "Lista numerada",
          () => editor.chain().focus().toggleOrderedList().run(),
          <ListOrdered />
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        {boton(
          false,
          "Deshacer",
          () => editor.chain().focus().undo().run(),
          <Undo2 />,
          !editor.can().undo()
        )}
        {boton(
          false,
          "Rehacer",
          () => editor.chain().focus().redo().run(),
          <Redo2 />,
          !editor.can().redo()
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

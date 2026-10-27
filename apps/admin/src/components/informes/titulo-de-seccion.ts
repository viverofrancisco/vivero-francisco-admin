import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tituloDeSeccion: {
      /** Pone o quita el título: el primer bloque pasa de párrafo a título o al revés. */
      alternarTitulo: () => ReturnType;
    };
  }
}

/**
 * El título de una sección como un bloque propio —un `<h2>` al principio—, y
 * no la primera línea por ser la primera (`htmlDelEditorDeSeccion` /
 * `partirSeccion` en `@vivero/shared`). Así una sección puede no tener título,
 * y se le pone o se le quita como en cualquier editor:
 *
 * - **Retroceso al principio del título** lo vuelve texto normal, a la
 *   izquierda y sin las marcas que quedaban "pegadas" al cursor: antes,
 *   vaciar el título dejaba la línea vestida de título para siempre.
 * - **`alternarTitulo`** (el botón *Título* de la barra) convierte el primer
 *   bloque en título, con la negrita y el subrayado que el título lleva por
 *   omisión, o lo devuelve a párrafo. Solo con el cursor en el primer bloque:
 *   un título en medio del texto no es nada que el PDF sepa imprimir.
 *
 * La app tiene la misma extensión dentro de `TituloBridge`
 * (`apps/app-admin/components/informes/puentes.ts`): un cambio aquí va allá.
 */
export const TituloDeSeccion = Extension.create({
  name: "tituloDeSeccion",
  // Antes que el retroceso de Tiptap, que con el título vacío ya lo volvería
  // párrafo pero dejándole las marcas guardadas.
  priority: 1000,

  addCommands() {
    return {
      alternarTitulo:
        () =>
        ({ state, chain }) => {
          const primero = state.doc.firstChild;
          if (!primero || state.selection.$from.index(0) !== 0) return false;
          if (primero.type.name === "heading") {
            return chain()
              .setParagraph()
              .command(({ tr }) => {
                tr.setStoredMarks([]);
                return true;
              })
              .run();
          }
          const { bold, underline } = state.schema.marks;
          const fin = 1 + primero.content.size;
          return chain()
            .setHeading({ level: 2 })
            .command(({ tr }) => {
              const marcas = [bold?.create(), underline?.create()].filter((m) => !!m);
              if (fin > 1) marcas.forEach((m) => tr.addMark(1, fin, m));
              else tr.setStoredMarks(marcas);
              return true;
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { empty, $from } = editor.state.selection;
        if (
          !empty ||
          $from.parent.type.name !== "heading" ||
          $from.index(0) !== 0 ||
          $from.parentOffset !== 0
        ) {
          return false;
        }
        return editor
          .chain()
          .setParagraph()
          .command(({ tr }) => {
            tr.setStoredMarks([]);
            return true;
          })
          .run();
      },
    };
  },
});

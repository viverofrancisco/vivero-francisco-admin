"use client";

import { X } from "lucide-react";

/**
 * La barra de selección múltiple del teléfono.
 *
 * Flota arriba del nav, como el pie de selección de Shopify. Aparece con el
 * modo prendido **aunque no haya nada marcado**: es lo que dice que el modo
 * está prendido, y por dónde se sale.
 *
 * Existe porque en escritorio las casillas viven en una columna de la tabla y
 * en el teléfono no hay dónde ponerlas sin gastar ancho en todas las filas para
 * siempre; así que ahí son un modo que se prende desde el ⋯ del encabezado y se
 * apaga desde acá.
 *
 * **La acción no va en rojo aunque destruya.** La variante `destructive` de la
 * casa es un fondo al 10% pensado para una tarjeta clara, y sobre esta barra
 * oscura desaparece. Lo que hace falta es contraste; el rojo lo pone la
 * confirmación, que es donde se decide.
 *
 * Con más de una acción, la segunda y las que sigan van detrás de un ⋯ al lado:
 * a 375 px no entran más de tres o cuatro controles.
 */
export function BarraSeleccionMovil({
  cuantas,
  children,
  onSalir,
}: {
  cuantas: number;
  /** Las acciones, a la derecha. Ver la nota de arriba sobre el color. */
  children?: React.ReactNode;
  onSalir: () => void;
}) {
  return (
    <div className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-40 md:hidden">
      <div className="flex items-center gap-2 rounded-2xl bg-foreground p-2 text-background shadow-lg">
        <button
          type="button"
          onClick={onSalir}
          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold hover:bg-background/10"
        >
          <X className="h-4 w-4" />
          <span className="tabular-nums">{cuantas}</span>
          <span className="sr-only">Salir de la selección</span>
        </button>
        <span className="flex-1" />
        {children}
      </div>
    </div>
  );
}

/**
 * Las clases de un botón de acción sobre la barra oscura. Ver la nota del
 * componente: claro sobre oscuro, nunca `destructive`.
 */
export const ACCION_BARRA_MOVIL =
  "bg-background/15 text-background hover:bg-background/25 disabled:opacity-45";

"use client";

import { Loader2 } from "lucide-react";

/**
 * El encabezado de un formulario en el teléfono: *Cancelar* a la izquierda, el
 * título en el medio, la acción a la derecha, pegado arriba mientras el
 * formulario scrollea.
 *
 * Es la cabecera de la app (`EncabezadoDeFormulario`) y la de *Nueva orden*
 * en el portal, sacada para que *Nuevo cliente*, *Nuevo personal* y *Nuevo
 * grupo* la compartan en vez de copiarla tres veces. La barra de abajo
 * (`StickyFormActions`) quedaba lejos del pulgar y debajo del teclado en
 * cuanto se tocaba un campo; en el escritorio sigue siendo la de siempre, así
 * que esto va solo abajo de `md`. Va **adentro** del `<form>`: la acción es un
 * `submit`.
 */
export function EncabezadoFormularioMovil({
  titulo,
  accion,
  cargando = false,
  deshabilitado = false,
  onCancelar,
}: {
  titulo: string;
  /** "Crear", "Guardar". */
  accion: string;
  cargando?: boolean;
  deshabilitado?: boolean;
  onCancelar: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex h-12 items-center gap-1.5 border-b bg-card/95 px-2.5 backdrop-blur-sm md:hidden">
      <button
        type="button"
        onClick={onCancelar}
        disabled={cargando}
        className="flex h-[30px] flex-none items-center justify-center rounded-lg bg-muted px-3 text-[13px] font-semibold text-foreground active:opacity-60 disabled:opacity-40"
      >
        Cancelar
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
        {titulo}
      </h1>
      <button
        type="submit"
        disabled={cargando || deshabilitado}
        className="flex h-[30px] flex-none items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground active:opacity-60 disabled:opacity-40"
      >
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : accion}
      </button>
    </div>
  );
}

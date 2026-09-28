"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CAMPOS_ORDEN_PRODUCTOS,
  CAMPO_ORDEN_PRODUCTOS_LABEL,
  OPCIONES_ORDEN_PRODUCTOS,
  ORDEN_PRODUCTOS_POR_DEFECTO,
  codificarOrden,
  decodificarOrden,
  etiquetaDeDireccion,
  invertirOrden,
  mismoOrden,
  ordenPorCampo,
  type OrdenProductos,
} from "@vivero/shared";

/**
 * Cómo se elige el orden del catálogo, en las dos presentaciones de siempre.
 *
 * En escritorio, un desplegable con las ocho combinaciones —"Creado · Más
 * recientes primero"—, que ahí hay lugar para leerlas. En el teléfono, el ⇅
 * al lado del buscador abre una hoja desde abajo con los campos como filas y
 * la dirección al lado del elegido, que un segundo toque invierte; elegir
 * otra fila la pone con la dirección que se propone para ella. Es la hoja de
 * Shopify y la misma pantalla que la app (`SelectorDeOrden`), y **no se
 * cierra al elegir**: la segunda decisión, la dirección, se toma ahí mismo.
 *
 * Un solo componente para las dos, así la lista de campos no se separa entre
 * pantallas. El botón del teléfono se pinta con algo puesto cuando el orden no
 * es el de siempre, que es lo único que hace falta saber sin abrirlo.
 */
export function SelectorOrdenProductos({
  orden,
  onChange,
}: {
  orden: OrdenProductos;
  onChange: (orden: OrdenProductos) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const distinto = !mismoOrden(orden, ORDEN_PRODUCTOS_POR_DEFECTO);

  return (
    <>
      {/* El corte es `md`, el mismo que decide tabla o lista. */}
      <div className="hidden md:block md:w-64">
        <CustomSelect
          value={codificarOrden(orden)}
          onChange={(v) => onChange(decodificarOrden(v))}
          options={OPCIONES_ORDEN_PRODUCTOS}
          anchoMinimo={256}
        />
      </div>

      <Button
        variant="outline"
        size="icon"
        className={cn(
          "flex-none md:hidden",
          distinto && "border-primary/30 bg-primary/5 text-primary"
        )}
        aria-label="Ordenar productos"
        onClick={() => setAbierto(true)}
      >
        <ArrowDownUp className="h-4 w-4" />
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>Ordenar por</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-3">
            {CAMPOS_ORDEN_PRODUCTOS.map((campo) => {
              const activa = orden.campo === campo;
              return (
                <button
                  key={campo}
                  type="button"
                  aria-pressed={activa}
                  onClick={() =>
                    onChange(activa ? invertirOrden(orden) : ordenPorCampo(campo))
                  }
                  className="flex w-full items-center justify-between gap-3 border-t border-border px-2 py-3.5 text-left text-[15px] text-foreground first:border-t-0 active:bg-secondary"
                >
                  <span>{CAMPO_ORDEN_PRODUCTOS_LABEL[campo]}</span>
                  {activa ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {etiquetaDeDireccion(orden)}
                      <ArrowDownUp className="h-4 w-4" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

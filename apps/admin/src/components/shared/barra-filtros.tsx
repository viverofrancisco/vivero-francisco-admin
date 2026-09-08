"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * La barra de filtros de un listado: buscador siempre visible y, al lado, los
 * controles.
 *
 * En escritorio los controles van en línea, como siempre. En móvil se
 * esconden detrás de un botón que los abre a pantalla completa: tres selects
 * apilados se comían dos renglones enteros —más alto que la propia tabla— y
 * el listado, que es lo que la persona vino a ver, arrancaba abajo de todo.
 *
 * El envoltorio de escritorio es `md:contents`, no un flex propio: así los
 * controles siguen siendo hijos directos de la barra y envuelven de a uno
 * como antes, en vez de saltar de renglón todos juntos.
 */
export function BarraFiltros({
  busqueda,
  activos,
  onLimpiar,
  children,
  escritorio = "linea",
  className,
}: {
  /** El campo de búsqueda. Se ve siempre, en móvil y en escritorio. */
  busqueda?: React.ReactNode;
  /** Cuántos filtros están puestos: es lo que cuenta el globito del botón. */
  activos: number;
  /** Dejarlos todos en su valor vacío. */
  onLimpiar: () => void;
  /** Los controles. En línea en escritorio, apilados a pantalla completa en móvil. */
  children: React.ReactNode;
  /**
   * Cómo se ven en escritorio. `"linea"` los pone en la barra, que es lo que
   * sirve con dos o tres. `"popover"` los guarda detrás de un botón, para las
   * pantallas que tienen seis o siete y no entran en un renglón. En móvil los
   * dos terminan en el mismo panel a pantalla completa.
   */
  escritorio?: "linea" | "popover";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const globito =
    activos > 0 ? (
      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
        {activos}
      </span>
    ) : null;

  return (
    <div
      className={cn(
        // Todo lo de la barra a la misma altura. El `h-9` va acá y no en cada
        // pantalla porque el buscador lo pone quien la usa: el `Input` del
        // proyecto mide `h-8`, que al lado de un botón se veía desalineado, y
        // 36 px es el término medio que además deja un blanco tocable con el
        // pulgar —32 px es chico para un dedo.
        "flex flex-none flex-wrap items-center gap-2 [&_input]:h-9 md:gap-3",
        className
      )}
    >
      {busqueda}

      {escritorio === "popover" ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="hidden h-9 md:inline-flex" />
            }
          >
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
            Filtros
            {globito}
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4">{children}</PopoverContent>
        </Popover>
      ) : (
        <div className="hidden md:contents">{children}</div>
      )}

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          aria-label={
            activos > 0 ? `Filtros (${activos} puestos)` : "Filtros"
          }
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" />
          {/* Cuántos hay puestos, sin abrir. Escondidos detrás de un botón,
              lo único que dice que el listado está recortado es este número. */}
          {activos > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activos}
            </span>
          )}
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Popup className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden">
            <div className="flex h-16 flex-none items-center justify-between border-b border-border px-4">
              <DialogPrimitive.Title className="text-base font-bold">
                Filtros
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Cerrar filtros"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            {/* Los controles vienen con el ancho que les sirve en la barra de
                escritorio (`w-40`, `w-48`); acá cada uno ocupa el renglón. */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [&>*]:w-full!">
              {children}
            </div>

            <div className="flex flex-none gap-3 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onLimpiar}
                disabled={activos === 0}
              >
                Limpiar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Ver resultados
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

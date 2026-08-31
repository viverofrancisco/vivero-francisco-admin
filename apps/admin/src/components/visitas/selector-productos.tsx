"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface ProductoElegible {
  id: string;
  nombre: string;
}

const POR_PAGINA = 8;

/**
 * Elegir productos en un popup, no en un dropdown.
 *
 * Lo elegido **sigue en la lista**, marcado: un catálogo que se acorta a medida
 * que se elige obliga a recordar qué se sacó, y desmarcar se vuelve imposible
 * sin cerrar. Va paginado porque el catálogo crece y una lista larga dentro de
 * un modal se navega peor que ocho filas con flechas.
 */
export function SelectorProductos({
  open,
  onOpenChange,
  catalogo,
  seleccionados,
  etiqueta,
  fijos,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalogo: ProductoElegible[];
  seleccionados: string[];
  /** Etiqueta opcional por producto: qué cubre el plan del cliente. */
  etiqueta?: (id: string) => string | null;
  /**
   * Productos que no se pueden destildar acá. Son los que trae el plan
   * elegido: la forma de sacarlos es soltar el plan, no de a uno.
   */
  fijos?: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  const q = busqueda.trim().toLowerCase();
  const filtrados = q
    ? catalogo.filter((p) => p.nombre.toLowerCase().includes(q))
    : catalogo;

  // La página se acota al renderizar en vez de resetearse en un efecto: filtrar
  // puede dejar menos páginas que la actual y no hace falta un re-render extra.
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(
    actual * POR_PAGINA,
    actual * POR_PAGINA + POR_PAGINA
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar productos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar producto..."
              className="pl-9"
            />
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              Ningún producto coincide con «{busqueda.trim()}».
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {visibles.map((p) => {
                const elegido = seleccionados.includes(p.id);
                const nota = etiqueta?.(p.id) ?? null;
                const fijo = fijos?.(p.id) ?? false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !fijo && onToggle(p.id)}
                    aria-pressed={elegido}
                    disabled={fijo}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                      fijo ? "opacity-60" : "hover:bg-accent/50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        elegido
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {elegido && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.nombre}
                    </span>
                    {nota && (
                      <Badge variant="secondary" className="flex-none text-xs">
                        {nota}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {seleccionados.length}{" "}
              {seleccionados.length === 1 ? "elegido" : "elegidos"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={actual === 0}
                onClick={() => setPagina(actual - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {actual + 1} / {paginas}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={actual >= paginas - 1}
                onClick={() => setPagina(actual + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

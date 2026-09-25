"use client";

import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { nombreCliente } from "@vivero/shared";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";

/** Lo que hace falta de un cliente para elegirlo: el nombre y lo que lo distingue. */
export interface ClienteElegible {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono: string | null;
  /** Marcado como inactivo desde cuándo; `null` = activo. */
  inactivoDesde: Date | string | null;
  /** El sector de su primera propiedad, para reconocerlo en la lista. */
  sector: string | null;
}

/**
 * Elegir el cliente entre cientos, en el teléfono: una fila que abre una hoja
 * con buscador, la misma de la app (`SelectorCliente`). El inactivo se ve,
 * atenuado y sin poder elegirse: si volvió a contratar, primero se lo
 * reactiva.
 *
 * En el escritorio el desplegable con buscador ya hace esto; en un teléfono
 * un desplegable anclado al campo pelea con el teclado y muestra cuatro filas.
 */
export function SelectorClienteMovil({
  clientes,
  valor,
  onElegir,
}: {
  clientes: ClienteElegible[];
  valor: string | null;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const elegido = clientes.find((c) => c.id === valor) ?? null;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? clientes.filter((c) =>
          `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase().includes(q)
        )
      : clientes;
    // Treinta alcanzan: con más, lo que sigue es escribir otra letra.
    return lista.slice(0, 30);
  }, [busqueda, clientes]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setBusqueda("");
          setAbierto(true);
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 text-left text-[15px] transition-colors active:bg-muted"
        aria-label="Cliente"
      >
        <span className={cn("truncate", !elegido && "text-muted-foreground")}>
          {elegido ? nombreCliente(elegido) : "Seleccionar cliente"}
        </span>
        <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
      </button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-[88dvh]"
        >
          <SheetTitle className="sr-only">Elegir cliente</SheetTitle>
          <div className="flex-none p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                className="h-10 rounded-xl bg-muted pl-9"
                autoFocus
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {filtrados.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Sin coincidencias.
              </p>
            ) : (
              filtrados.map((c) => {
                const activo = c.id === valor;
                const inactivo = c.inactivoDesde !== null;
                const detalle = [
                  inactivo ? "Inactivo" : null,
                  c.telefono,
                  c.sector,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={inactivo}
                    onClick={() => {
                      onElegir(c.id);
                      setAbierto(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left first:border-t-0",
                      activo && "bg-primary/5",
                      inactivo ? "opacity-50" : "active:bg-muted"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {nombreCliente(c)}
                      </span>
                      {detalle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {detalle}
                        </span>
                      )}
                    </span>
                    {activo && (
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

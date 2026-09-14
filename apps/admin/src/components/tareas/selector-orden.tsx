"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowDownUp, Check } from "lucide-react";
import { OPCIONES_ORDEN, type ModoOrden } from "./orden-tareas";

/**
 * Cómo se elige el orden, en los dos tamaños.
 *
 * En escritorio es un desplegable con el nombre del orden puesto, que hay
 * espacio de sobra para leerlo. En el teléfono ese mismo control se comía una
 * línea entera para decir algo que casi nunca se cambia, así que queda un ícono
 * al lado del buscador y las opciones se abren en un cajón desde abajo —donde
 * está el pulgar, y con renglones grandes de tocar.
 *
 * Es un solo componente y no dos usos sueltos para que el estado —cuál está
 * elegido, si está deshabilitado— se pase una vez y no pueda desincronizarse
 * entre una pantalla y la otra.
 */
export function SelectorOrden({
  value,
  onChange,
  disabled = false,
}: {
  value: ModoOrden;
  onChange: (modo: ModoOrden) => void;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  function elegir(modo: ModoOrden) {
    setAbierto(false);
    if (modo !== value) onChange(modo);
  }

  return (
    <>
      {/* El corte es `md`, el mismo que decide tabla o lista: así el ícono
          aparece exactamente donde aparece la lista de teléfono. */}
      <div className="hidden md:block md:w-56">
        <CustomSelect
          value={value}
          onChange={(v) => onChange(v as ModoOrden)}
          options={OPCIONES_ORDEN}
          anchoMinimo={220}
          disabled={disabled}
        />
      </div>

      <Button
        variant="outline"
        size="icon"
        className="flex-none md:hidden"
        aria-label="Ordenar"
        disabled={disabled}
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
            <SheetTitle>Ordenar</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-4">
            {OPCIONES_ORDEN.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => elegir(o.value)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left text-sm hover:bg-muted"
                aria-pressed={value === o.value}
              >
                <span className={value === o.value ? "font-semibold" : ""}>
                  {o.label}
                </span>
                {value === o.value ? (
                  <Check className="h-4 w-4 flex-none text-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

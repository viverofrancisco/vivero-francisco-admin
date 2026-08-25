"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Cuántos años entran en una página de la grilla. */
const ANIOS_POR_PAGINA = 12;

/**
 * El título "Agosto 2026" de un calendario, convertido en salto directo.
 *
 * Con solo flechas de mes, ir a una visita de 2024 son veinte y pico de clicks.
 * Acá se elige el mes en una grilla, y el año en otra que avanza de a doce: de
 * 2026 a 2004 son tres clicks.
 */
export function MonthYearPicker({
  anio,
  mes,
  onChange,
  className,
}: {
  anio: number;
  /** 0–11, como `Date.getMonth()`. */
  mes: number;
  onChange: (anio: number, mes: number) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"meses" | "anios">("meses");
  /** Año que muestra la grilla de meses mientras está abierta. */
  const [anioVisible, setAnioVisible] = useState(anio);
  /** Primer año de la página de años. */
  const [decada, setDecada] = useState(anio - (anio % ANIOS_POR_PAGINA));

  const hoy = new Date();

  const abrir = (v: boolean) => {
    if (v) {
      // Reabrir siempre parte del mes que se está viendo, no del último toqueteo.
      setVista("meses");
      setAnioVisible(anio);
      setDecada(anio - (anio % ANIOS_POR_PAGINA));
    }
    setAbierto(v);
  };

  return (
    <Popover open={abierto} onOpenChange={abrir}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              // `whitespace-nowrap`: en un calendario angosto el mes y el año
              // se partían en dos líneas.
              "flex flex-none items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-muted",
              className
            )}
          >
            {MESES_LARGO[mes]} {anio}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent className="w-64 p-3" align="center">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              vista === "meses"
                ? setAnioVisible(anioVisible - 1)
                : setDecada(decada - ANIOS_POR_PAGINA)
            }
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={vista === "meses" ? "Año anterior" : "Años anteriores"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setVista(vista === "meses" ? "anios" : "meses")}
            className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-muted"
          >
            {vista === "meses"
              ? anioVisible
              : `${decada} – ${decada + ANIOS_POR_PAGINA - 1}`}
          </button>

          <button
            type="button"
            onClick={() =>
              vista === "meses"
                ? setAnioVisible(anioVisible + 1)
                : setDecada(decada + ANIOS_POR_PAGINA)
            }
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={vista === "meses" ? "Año siguiente" : "Años siguientes"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {vista === "meses"
            ? MESES_CORTO.map((nombre, i) => {
                const elegido = anioVisible === anio && i === mes;
                const esteMes =
                  anioVisible === hoy.getFullYear() && i === hoy.getMonth();
                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => {
                      onChange(anioVisible, i);
                      setAbierto(false);
                    }}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      elegido
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "hover:bg-muted",
                      !elegido && esteMes && "font-bold text-primary"
                    )}
                  >
                    {nombre}
                  </button>
                );
              })
            : Array.from({ length: ANIOS_POR_PAGINA }, (_, i) => {
                const a = decada + i;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAnioVisible(a);
                      setVista("meses");
                    }}
                    className={cn(
                      "rounded-md py-1.5 text-sm transition-colors",
                      a === anio
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "hover:bg-muted",
                      a !== anio && a === hoy.getFullYear() && "font-bold text-primary"
                    )}
                  >
                    {a}
                  </button>
                );
              })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

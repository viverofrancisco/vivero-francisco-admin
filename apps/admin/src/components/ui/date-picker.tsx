"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

const diasDelMes = (anio: number, mes: number) =>
  new Date(anio, mes + 1, 0).getDate();

/** Lunes = 0, para que la grilla arranque en lunes. */
function primerDia(anio: number, mes: number) {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

/**
 * Un campo de fecha con su calendario.
 *
 * **El calendario va en un portal** (`Popover`), no en un `absolute` colgado
 * del campo. Así estaba antes y se cortaba: cuando abajo no entraba se abría
 * hacia arriba, y si tampoco entraba arriba, el `overflow` del contenedor que
 * scrollea le comía la mitad de encima —el encabezado con el mes y las
 * primeras semanas—, dejando visibles solo los últimos días. Pasaba en
 * pantallas bajas y no en las altas, así que dependía de con qué monitor se
 * abriera la misma pantalla. Base UI lo reubica solo para que entre.
 *
 * El encabezado es el `MonthYearPicker` de siempre: saltar a otro año son tres
 * clicks y no veinte.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [abierto, setAbierto] = useState(false);

  const hoy = new Date();
  const inicial = value ? new Date(value + "T00:00:00") : hoy;
  const [vista, setVista] = useState({
    anio: inicial.getFullYear(),
    mes: inicial.getMonth(),
  });

  // Si la fecha cambia desde afuera, el calendario se para donde corresponde.
  // Ajuste durante el render y no en un efecto: así no se pinta primero el mes
  // viejo para corregirlo después.
  const [ultimoValor, setUltimoValor] = useState(value);
  if (value !== ultimoValor) {
    setUltimoValor(value);
    if (value) {
      const d = new Date(value + "T00:00:00");
      setVista({ anio: d.getFullYear(), mes: d.getMonth() });
    }
  }

  const { anio, mes } = vista;
  const total = diasDelMes(anio, mes);
  const offset = primerDia(anio, mes);

  const deshabilitada = (iso: string) =>
    (minDate !== undefined && iso < minDate) ||
    (maxDate !== undefined && iso > maxDate);

  const mover = (delta: number) => {
    const d = new Date(anio, mes + delta, 1);
    setVista({ anio: d.getFullYear(), mes: d.getMonth() });
  };

  const elegir = (dia: number) => {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(
      dia
    ).padStart(2, "0")}`;
    if (deshabilitada(iso)) return;
    onChange(iso);
    setAbierto(false);
  };

  const mostrar = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !value && "text-muted-foreground",
              className
            )}
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {value ? mostrar(value) : placeholder}
            </span>
            {value && (
              <span
                role="button"
                aria-label="Borrar la fecha"
                // El aspa está adentro del disparador, así que su clic tiene
                // que morir acá o además abre el calendario. También el
                // `pointerdown`: es con lo que el popover abre.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setAbierto(false);
                }}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
          </button>
        }
      />
      {/* Con tope de alto: en una pantalla muy baja el calendario entero no
          entra, y es preferible poder scrollearlo adentro a que se corte. */}
      <PopoverContent className="max-h-[calc(100dvh-2rem)] w-72 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => mover(-1)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <MonthYearPicker
            anio={anio}
            mes={mes}
            onChange={(a, m) => setVista({ anio: a, mes: m })}
          />
          <button
            type="button"
            onClick={() => mover(1)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`vacio-${i}`} className="h-8" />
          ))}
          {Array.from({ length: total }).map((_, i) => {
            const dia = i + 1;
            const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(
              dia
            ).padStart(2, "0")}`;
            const elegida = value === iso;
            const esHoy =
              dia === hoy.getDate() &&
              mes === hoy.getMonth() &&
              anio === hoy.getFullYear();
            const sinPermiso = deshabilitada(iso);

            return (
              <button
                key={dia}
                type="button"
                disabled={sinPermiso}
                onClick={() => elegir(dia)}
                className={cn(
                  "h-8 w-full rounded text-sm transition-colors",
                  elegida
                    ? "bg-primary text-primary-foreground"
                    : esHoy
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted",
                  sinPermiso &&
                    "cursor-not-allowed text-muted-foreground/40 hover:bg-transparent"
                )}
              >
                {dia}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

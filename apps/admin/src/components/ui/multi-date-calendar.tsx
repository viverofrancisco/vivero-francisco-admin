"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function diasDelMes(anio: number, mes: number) {
  return new Date(anio, mes + 1, 0).getDate();
}

/** Lunes = 0, para que la grilla arranque en lunes. */
function primerDia(anio: number, mes: number) {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function clave(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Calendario en línea para elegir varias fechas.
 *
 * A diferencia de `MultiDatePicker`, no es un desplegable: se muestra siempre y
 * abarca dos meses. Agendar suele cruzar el fin de mes —"los martes de acá a
 * seis semanas"— y con un solo mes hay que ir y volver contando.
 */
export function MultiDateCalendar({
  value,
  onChange,
  meses = 2,
  minDate,
  mesInicial,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  meses?: number;
  /** `YYYY-MM-DD`; los días anteriores quedan deshabilitados. */
  minDate?: string;
  /**
   * `YYYY-MM-DD` con el que abrir cuando no hay nada elegido.
   *
   * Editar una visita de agosto y que el calendario abra en el mes de hoy
   * obliga a navegar hasta donde ya se sabía que estaba.
   */
  mesInicial?: string;
  className?: string;
}) {
  // Lo elegido manda; después el mes sugerido; y si no hay nada, hoy.
  const [base, setBase] = useState(() => {
    const ancla = value[0] ?? mesInicial;
    const d = ancla ? new Date(`${ancla}T00:00:00`) : new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  const mover = (paso: number) => {
    const d = new Date(base.anio, base.mes + paso, 1);
    setBase({ anio: d.getFullYear(), mes: d.getMonth() });
  };

  const alternar = (fecha: string) => {
    if (minDate && fecha < minDate) return;
    onChange(
      value.includes(fecha)
        ? value.filter((v) => v !== fecha)
        : [...value, fecha].sort()
    );
  };

  const hoy = new Date();
  const hoyClave = clave(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return (
    <div className={cn("space-y-3", className)}>
      {/* Con un solo mes no hay dos columnas que repartir: dejarlas puestas
          lo encogía a la mitad del contenedor. */}
      <div className={cn("grid gap-6", meses > 1 && "sm:grid-cols-2")}>
        {Array.from({ length: meses }, (_, i) => {
          const d = new Date(base.anio, base.mes + i, 1);
          const anio = d.getFullYear();
          const mes = d.getMonth();
          const total = diasDelMes(anio, mes);
          const offset = primerDia(anio, mes);

          return (
            <div key={`${anio}-${mes}`}>
              <div className="mb-2 flex items-center justify-between">
                {/* Las flechas van solo en los extremos: mueven el par entero. */}
                {i === 0 ? (
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="h-6 w-6" />
                )}
                <MonthYearPicker
                  anio={anio}
                  mes={mes}
                  // Con varios meses a la vista, elegir en el segundo lo deja
                  // en su lugar en vez de correr el par.
                  onChange={(a, m) => setBase({ anio: a, mes: m - i })}
                />
                {i === meses - 1 ? (
                  <button
                    type="button"
                    onClick={() => mover(1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="h-6 w-6" />
                )}
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DIAS.map((dia) => (
                  <span
                    key={dia}
                    className="py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {dia}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, k) => (
                  <span key={`hueco-${k}`} />
                ))}
                {Array.from({ length: total }, (_, k) => {
                  const dia = k + 1;
                  const fecha = clave(anio, mes, dia);
                  const elegida = value.includes(fecha);
                  const deshabilitada = Boolean(minDate && fecha < minDate);
                  return (
                    <button
                      key={fecha}
                      type="button"
                      onClick={() => alternar(fecha)}
                      disabled={deshabilitada}
                      className={cn(
                        "aspect-square rounded-md text-sm transition-colors",
                        deshabilitada && "cursor-not-allowed opacity-30",
                        elegida
                          ? "bg-primary font-semibold text-primary-foreground"
                          : !deshabilitada && "hover:bg-muted",
                        !elegida && fecha === hoyClave && "font-bold text-primary"
                      )}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

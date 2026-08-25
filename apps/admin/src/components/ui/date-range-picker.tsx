"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

const diasDelMes = (anio: number, mes: number) =>
  new Date(anio, mes + 1, 0).getDate();

/** Lunes = 0, para que la grilla arranque en lunes. */
function primerDia(anio: number, mes: number) {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

/** Normaliza por `Date`, así `mes = 12` cae en enero del año siguiente. */
function clave(anio: number, mes: number, dia: number) {
  const d = new Date(anio, mes, dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const corta = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const conAnio = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Rangos de uso diario.
 *
 * Se calculan al abrir y no al cargar el módulo: el portal queda abierto todo
 * el día y "Hoy" no puede quedar clavado en la fecha en que se montó.
 */
function atajos(): { nombre: string; desde: string; hasta: string }[] {
  const hoy = new Date();
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const iso = (x: Date) => clave(x.getFullYear(), x.getMonth(), x.getDate());

  // La semana arranca el lunes, como la grilla. El domingo se cuenta desde el
  // lunes y no desde hoy: si el lunes cayó en el mes anterior, sumarle días al
  // mes de hoy da una fecha de otra semana.
  const lunes = new Date(a, m, d - ((hoy.getDay() + 6) % 7));
  const domingo = new Date(
    lunes.getFullYear(),
    lunes.getMonth(),
    lunes.getDate() + 6,
  );

  const mes = (desplazamiento: number) => ({
    desde: clave(a, m + desplazamiento, 1),
    hasta: iso(new Date(a, m + desplazamiento + 1, 0)),
  });

  const dia = (desplazamiento: number) => {
    const f = clave(a, m, d + desplazamiento);
    return { desde: f, hasta: f };
  };

  return [
    { nombre: "Hoy", ...dia(0) },
    { nombre: "Ayer", ...dia(-1) },
    { nombre: "Mañana", ...dia(1) },
    { nombre: "Esta semana", desde: iso(lunes), hasta: iso(domingo) },
    { nombre: "Este mes", ...mes(0) },
    { nombre: "Mes pasado", ...mes(-1) },
    { nombre: "Próximo mes", ...mes(1) },
  ];
}

/** "1 – 31 ago 2026", o una sola fecha si el rango es de un día. */
function etiqueta(desde: string, hasta: string): string | null {
  if (!desde && !hasta) return null;
  if (desde && hasta && desde !== hasta)
    return `${corta(desde)} – ${conAnio(hasta)}`;
  return conAnio(desde || hasta);
}

/**
 * Un solo campo para un rango de fechas.
 *
 * Reemplaza el par Desde/Hasta: dos campos ocupan el doble, obligan a abrir dos
 * calendarios y dejan elegir un "hasta" anterior al "desde". Acá el rango se
 * pinta sobre los mismos dos meses —un click abre, el siguiente cierra— igual
 * que en cualquier buscador de pasajes.
 *
 * El cambio se avisa recién con el rango completo, para no disparar una consulta
 * a medio elegir. Cerrar con una sola fecha marcada la toma como día único.
 */
export function DateRangePicker({
  desde,
  hasta,
  onChange,
  placeholder = "Cualquier fecha",
  meses = 2,
  className,
}: {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  placeholder?: string;
  meses?: number;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  /** Primer extremo elegido mientras el rango está a medias. */
  const [ancla, setAncla] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);

  const hoy = new Date();
  const inicial = desde || hasta;
  const [base, setBase] = useState(() => {
    const d = inicial ? new Date(inicial + "T00:00:00Z") : hoy;
    return inicial
      ? { anio: d.getUTCFullYear(), mes: d.getUTCMonth() }
      : { anio: d.getFullYear(), mes: d.getMonth() };
  });

  const mover = (paso: number) => {
    const d = new Date(base.anio, base.mes + paso, 1);
    setBase({ anio: d.getFullYear(), mes: d.getMonth() });
  };

  // Lo que se ve pintado: el rango guardado, o el que se está armando.
  const [ini, fin] = ancla
    ? [ancla, encima && encima < ancla ? ancla : (encima ?? ancla)]
    : [desde, hasta];
  const [pintaIni, pintaFin] =
    ancla && encima && encima < ancla ? [encima, ancla] : [ini, fin];

  const elegir = (fecha: string) => {
    if (!ancla) {
      setAncla(fecha);
      setEncima(fecha);
      return;
    }
    const [a, b] = fecha < ancla ? [fecha, ancla] : [ancla, fecha];
    setAncla(null);
    setEncima(null);
    setAbierto(false);
    onChange(a, b);
  };

  const cerrar = (v: boolean) => {
    // Cerrar con un solo extremo marcado vale como día único.
    if (!v && ancla) {
      const a = ancla;
      setAncla(null);
      setEncima(null);
      onChange(a, a);
    }
    setAbierto(v);
  };

  const texto = etiqueta(desde, hasta);
  const hoyClave = clave(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return (
    <Popover open={abierto} onOpenChange={cerrar}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 text-sm transition-colors hover:bg-secondary/70",
              className,
            )}
          >
            <CalendarIcon className="h-4 w-4 flex-none text-muted-foreground" />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                !texto && "text-muted-foreground",
              )}
            >
              {texto ?? placeholder}
            </span>
            {texto && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Quitar fechas"
                className="flex-none rounded p-0.5 text-muted-foreground hover:bg-muted"
                onClick={(e) => {
                  // Sin esto el click abre el calendario además de limpiar.
                  e.stopPropagation();
                  onChange("", "");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        }
      />
      <PopoverContent className="w-auto">
        <div className="flex gap-4">
          {/* Rangos frecuentes: casi siempre se quiere uno de estos, y elegirlo
              a mano son dos clicks más y la posibilidad de errarle por un día. */}
          <div className="flex w-32 flex-none flex-col gap-0.5 border-r pr-3">
            {atajos().map((a) => {
              const activo = desde === a.desde && hasta === a.hasta;
              return (
                <button
                  key={a.nombre}
                  type="button"
                  onClick={() => {
                    const d = new Date(a.desde + "T00:00:00Z");
                    setBase({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() });
                    setAncla(null);
                    setEncima(null);
                    setAbierto(false);
                    onChange(a.desde, a.hasta);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    activo
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {a.nombre}
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: meses }, (_, i) => {
              const d = new Date(base.anio, base.mes + i, 1);
              const anio = d.getFullYear();
              const mes = d.getMonth();
              const total = diasDelMes(anio, mes);
              const offset = primerDia(anio, mes);

              return (
                <div key={`${anio}-${mes}`} className="w-56">
                  <div className="mb-2 flex items-center justify-between">
                    {/* Las flechas van en los extremos: mueven el par entero. */}
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
                      // El par se mueve junto: elegir en el mes de la derecha
                      // lo deja a la derecha, no a la izquierda.
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

                  <div
                    className="grid grid-cols-7 text-center"
                    onMouseLeave={() => ancla && setEncima(ancla)}
                  >
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
                      const esIni = Boolean(pintaIni) && fecha === pintaIni;
                      const esFin = Boolean(pintaFin) && fecha === pintaFin;
                      const dentro =
                        Boolean(pintaIni && pintaFin) &&
                        fecha > pintaIni &&
                        fecha < pintaFin;

                      return (
                        <button
                          key={fecha}
                          type="button"
                          onClick={() => elegir(fecha)}
                          onMouseEnter={() => ancla && setEncima(fecha)}
                          className={cn(
                            // El fondo del rango va en el contenedor y el círculo
                            // en el hijo: así los días intermedios se tocan y los
                            // extremos quedan redondeados.
                            "py-0.5",
                            dentro && "bg-primary/15",
                            esIni &&
                              pintaFin &&
                              pintaIni !== pintaFin &&
                              "rounded-l-md bg-primary/15",
                            esFin &&
                              pintaIni &&
                              pintaIni !== pintaFin &&
                              "rounded-r-md bg-primary/15",
                          )}
                        >
                          <span
                            className={cn(
                              "flex aspect-square w-8 items-center justify-center rounded-md text-sm transition-colors",
                              esIni || esFin
                                ? "bg-primary font-semibold text-primary-foreground"
                                : "hover:bg-muted",
                              !esIni &&
                                !esFin &&
                                fecha === hoyClave &&
                                "font-bold text-primary",
                            )}
                          >
                            {dia}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {ancla
              ? "Elegí la fecha de cierre"
              : (etiqueta(desde, hasta) ?? "Sin fechas")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!desde && !hasta && !ancla}
            onClick={() => {
              setAncla(null);
              setEncima(null);
              onChange("", "");
            }}
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

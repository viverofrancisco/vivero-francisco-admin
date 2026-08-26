"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Ban, ChevronDown, Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
  /** Se muestra pero no se puede elegir. */
  disabled?: boolean;
  /** Un renglón chico debajo del nombre. */
  hint?: string;
}

/**
 * Un título que parte la lista en grupos. No se elige ni se cuenta: sirve
 * cuando las opciones vienen de dos lados distintos y la diferencia importa
 * más que lo que entre en un `hint` repetido en cada fila.
 */
interface Encabezado {
  encabezado: string;
}

type Item = Option | Encabezado;

function esEncabezado(i: Item): i is Encabezado {
  return "encabezado" in i;
}

interface CustomSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: Item[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Ancho mínimo del desplegable, en px. Por omisión sale del ancho del
   * disparador, que alcanza cuando la opción es corta; con nombres largos, o
   * si el disparador es un botón chico, conviene forzarlo.
   */
  anchoMinimo?: number;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  searchable = false,
  searchPlaceholder = "Buscar...",
  clearable = false,
  disabled = false,
  className,
  anchoMinimo,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  /**
   * Posición del desplegable en coordenadas de la ventana.
   *
   * Va en un portal con `position: fixed` en vez de `absolute` dentro del
   * componente: así no lo recorta ni lo desborda ningún contenedor —tarjetas,
   * diálogos, tablas con scroll—, que era el problema de fondo. `null` mientras
   * está cerrado.
   */
  const [caja, setCaja] = useState<{
    top: number;
    left: number;
    width: number;
    above: boolean;
  } | null>(null);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // El desplegable vive en un portal, así que no alcanza con mirar `ref`.
      if (
        (ref.current && ref.current.contains(target)) ||
        (popupRef.current && popupRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Con `position: fixed` la caja no sigue al contenido: si la página se mueve
  // quedaría flotando en el aire, así que se cierra.
  //
  // Pero el listener va en captura, así que también le llegaba el scroll de la
  // propia lista: con muchas opciones, bajar para buscar una la cerraba. Un
  // scroll que nace adentro del desplegable no lo mueve de lugar y se ignora.
  useEffect(() => {
    if (!open) return;
    const cerrar = (e: Event) => {
      if (e.target instanceof Node && popupRef.current?.contains(e.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.toLowerCase();
    const coinciden = options.filter(
      (o) => esEncabezado(o) || o.label.toLowerCase().includes(q)
    );
    // Un encabezado sin nada debajo es un título de una lista vacía.
    return coinciden.filter((o, i) => {
      if (!esEncabezado(o)) return true;
      const siguiente = coinciden[i + 1];
      return siguiente !== undefined && !esEncabezado(siguiente);
    });
  }, [options, search, searchable]);

  const elegida = value
    ? options.find((o): o is Option => !esEncabezado(o) && o.value === value)
    : undefined;
  const selectedLabel = elegida?.label;

  const handleSelect = (option: Option) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setSearch("");
  };

  const ALTO_MAX = 260;

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Abre hacia arriba si abajo no entra… salvo que arriba entre todavía
      // menos, que es lo que pasa con un disparador cerca del borde superior.
      const abajo = window.innerHeight - rect.bottom;
      const arriba = rect.top;
      const above = abajo < ALTO_MAX && arriba > abajo;
      // Y no se sale de costado: con `anchoMinimo` la caja es más ancha que el
      // disparador, así que pegada a la derecha se iba fuera de la pantalla.
      const width = Math.max(rect.width, anchoMinimo ?? 0);
      const MARGEN = 8;
      const left = Math.max(
        MARGEN,
        Math.min(rect.left, window.innerWidth - width - MARGEN)
      );
      setCaja({
        top: above ? rect.top : rect.bottom,
        left,
        width,
        above,
      });
    }
    setOpen(!open);
    setSearch("");
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground"
        )}
      >
        {/* `title`: en un disparador angosto el nombre se corta, y el que
            está puesto es justo el que hay que poder leer. */}
        <span className="truncate" title={selectedLabel ?? undefined}>
          {selectedLabel ?? placeholder}
        </span>
        <div className="flex items-center gap-1">
          {clearable && value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              className="rounded p-0.5 hover:bg-gray-200"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open &&
        caja &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              top: caja.top,
              left: caja.left,
              width: caja.width,
              // Abriendo hacia arriba, `top` es el borde superior del trigger y
              // la caja crece hacia arriba desde ahí.
              transform: caja.above ? "translateY(-100%)" : undefined,
            }}
            className={cn(
              "fixed z-50 rounded-md border bg-white shadow-lg",
              caja.above ? "-mt-1" : "mt-1"
            )}
          >
          {searchable && (
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((option) =>
                esEncabezado(option) ? (
                  <p
                    key={`h-${option.encabezado}`}
                    className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1"
                  >
                    {option.encabezado}
                  </p>
                ) : (
                <div key={option.value} className="group/opt relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    // `aria-disabled` y no `disabled`: un botón deshabilitado no
                    // emite eventos de mouse en la mayoría de los navegadores, y
                    // entonces el motivo nunca se llegaría a ver.
                    aria-disabled={option.disabled}
                    className={cn(
                      "flex w-full items-start rounded-md px-2.5 py-1.5 text-sm text-left transition-colors",
                      option.disabled
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : value === option.value
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-gray-100"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && (
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                    </span>
                    {option.disabled && (
                      <Ban className="ml-2 h-3.5 w-3.5 flex-none opacity-60" />
                    )}
                  </button>
                </div>
                )
              )
            )}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}

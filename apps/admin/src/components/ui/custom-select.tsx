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
  /** Por qué no se puede elegir. Aparece al pasar el mouse por encima. */
  hint?: string;
}

interface CustomSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
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
  const openAbove = caja?.above ?? false;

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
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search, searchable]);

  const selectedLabel = value ? options.find((o) => o.value === value)?.label : undefined;

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
      const above = window.innerHeight - rect.bottom < ALTO_MAX;
      setCaja({
        top: above ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
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
        <span className="truncate">{selectedLabel ?? placeholder}</span>
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
              filtered.map((option) => (
                <div key={option.value} className="group/opt relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    // `aria-disabled` y no `disabled`: un botón deshabilitado no
                    // emite eventos de mouse en la mayoría de los navegadores, y
                    // entonces el motivo nunca se llegaría a ver.
                    aria-disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center rounded-md px-2.5 py-1.5 text-sm text-left transition-colors",
                      option.disabled
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : value === option.value
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-gray-100"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.disabled && (
                      <Ban className="ml-auto h-3.5 w-3.5 flex-none opacity-60" />
                    )}
                  </button>
                  {option.disabled && option.hint && (
                    <div
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute left-2 right-2 z-10 hidden rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg group-hover/opt:block",
                        // Acompaña la dirección del desplegable: si abre hacia
                        // arriba, el motivo abajo se saldría de la tarjeta.
                        openAbove ? "bottom-full" : "top-full"
                      )}
                    >
                      {option.hint}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}

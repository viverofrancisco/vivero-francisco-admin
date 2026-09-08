"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ArrowLeft,
  CalendarDays,
  DollarSign,
  FileText,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GlobalSearchResult,
  SearchResultItem,
  SearchType,
} from "@/lib/services/search.service";

const typeMeta: Record<SearchType, { label: string; icon: typeof Users }> = {
  cliente: { label: "Cliente", icon: Users },
  visita: { label: "Visita", icon: CalendarDays },
  orden: { label: "Orden", icon: DollarSign },
  suscripcion: { label: "Suscripción", icon: RefreshCw },
  informe: { label: "Informe", icon: FileText },
};

/** Cuántos resultados entran antes de "Ver todos". */
const PREVIEW_ESCRITORIO = 5;
/** En móvil hay una pantalla entera, así que caben más. */
const PREVIEW_MOVIL = 12;

const MIN_LETRAS = 2;

/**
 * La consulta: el texto con un respiro y lo que devolvió el servidor.
 *
 * Vive acá y no en cada buscador porque son dos —el de escritorio y el de
 * móvil— y la lógica es la misma; duplicarla es duplicar el debounce y el
 * cancelado.
 */
function useBusqueda(preview: number) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    // Debajo del mínimo la lista está oculta, así que no se muestran
    // resultados viejos; simplemente no consultamos.
    if (debounced.length < MIN_LETRAS) return;
    let cancelled = false;
    // El flag de carga va a un microtask para no ser un setState síncrono
    // dentro del cuerpo del efecto.
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/admin/search?q=${encodeURIComponent(debounced)}&limit=5`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GlobalSearchResult | null) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const items: SearchResultItem[] = result
    ? [
        ...result.clientes.items,
        ...result.visitas.items,
        ...result.ordenes.items,
        ...result.suscripciones.items,
        ...result.informes.items,
      ].slice(0, preview)
    : [];

  return { query, setQuery, debounced, result, loading, items };
}

/** Las filas y el pie de "ver todos" — lo único que comparten los dos modos. */
function ListaResultados({
  items,
  total,
  loading,
  consulta,
  onSelect,
  onVerTodos,
}: {
  items: SearchResultItem[];
  total: number;
  loading: boolean;
  consulta: string;
  onSelect: (href: string) => void;
  onVerTodos: () => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Buscando…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Sin resultados para “{consulta}”.
      </div>
    );
  }

  return (
    <>
      {items.map((item, i) => {
        const Icon = typeMeta[item.type].icon;
        return (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            onClick={() => onSelect(item.href)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-secondary/60",
              // Una línea entre resultado y resultado. Cada fila tiene hasta
              // tres renglones —título, subtítulo y detalle— y sin separador
              // no se ve dónde termina una visita y empieza la siguiente.
              // Va arriba y no abajo para no duplicar la del pie.
              i > 0 && "border-t border-border"
            )}
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-secondary text-green-700">
              <Icon className="h-[17px] w-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {item.title}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {item.subtitle}
              </span>
              {item.detalle && (
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {item.detalle}
                </span>
              )}
            </span>
            <span className="flex-none text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {typeMeta[item.type].label}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onVerTodos}
        className="block w-full border-t border-border bg-card px-3 py-3 text-center text-[13px] font-bold text-primary hover:bg-secondary/60"
      >
        Ver todos los resultados ({total})
      </button>
    </>
  );
}

/** El buscador del header en escritorio: campo siempre visible y desplegable. */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { query, setQuery, debounced, result, loading, items } =
    useBusqueda(PREVIEW_ESCRITORIO);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const goToResults = () => {
    if (debounced.length < MIN_LETRAS) return;
    setOpen(false);
    router.push(`/dashboard/buscar?q=${encodeURIComponent(debounced)}`);
  };

  const select = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToResults();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar..."
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      </div>

      {open && debounced.length >= MIN_LETRAS && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          <div className="max-h-[360px] overflow-y-auto">
            <ListaResultados
              items={items}
              total={result?.total ?? 0}
              loading={loading}
              consulta={debounced}
              onSelect={select}
              onVerTodos={goToResults}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * El buscador en móvil: un ícono en el header que abre la búsqueda a pantalla
 * completa.
 *
 * El campo inline no cabía —el ancho lo comparte con el logo y el avatar, y
 * queda un input de ~130 px— y encima el desplegable de resultados tapaba
 * media pantalla contra el teclado. Abierto entero, el teclado empuja la lista
 * y no hay nada más con qué competir.
 */
export function BuscadorMovil({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { query, setQuery, debounced, result, loading, items } =
    useBusqueda(PREVIEW_MOVIL);
  const inputRef = useRef<HTMLInputElement>(null);

  const cerrar = () => setOpen(false);

  const goToResults = () => {
    if (debounced.length < MIN_LETRAS) return;
    cerrar();
    router.push(`/dashboard/buscar?q=${encodeURIComponent(debounced)}`);
  };

  const select = (href: string) => {
    cerrar();
    setQuery("");
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className={cn(
          "flex h-10 w-10 flex-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden",
          className
        )}
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          // El foco va al campo, no al popup: se abre para escribir, y una
          // pantalla de búsqueda sin teclado obliga a un toque de más.
          initialFocus={inputRef}
          className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">
            Buscar
          </DialogPrimitive.Title>

          <div className="flex h-16 flex-none items-center gap-2 border-b border-border px-2">
            <DialogPrimitive.Close
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Cerrar búsqueda"
            >
              <ArrowLeft className="h-5 w-5" />
            </DialogPrimitive.Close>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToResults();
              }}
              placeholder="Buscar..."
              // El teléfono ofrece autocorregir y mayúscula inicial, y las dos
              // cosas arruinan un apellido o un número de orden.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              type="search"
              className="h-11 min-w-0 flex-1 bg-transparent pr-2 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {debounced.length < MIN_LETRAS ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Escribe al menos {MIN_LETRAS} letras.
                <span className="mt-1 block text-xs">
                  Clientes, visitas, órdenes, suscripciones e informes.
                </span>
              </div>
            ) : (
              <ListaResultados
                items={items}
                total={result?.total ?? 0}
                loading={loading}
                consulta={debounced}
                onSelect={select}
                onVerTodos={goToResults}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

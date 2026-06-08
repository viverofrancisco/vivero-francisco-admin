"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, CalendarDays, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GlobalSearchResult,
  SearchResultItem,
  SearchType,
} from "@/lib/services/search.service";

const typeMeta: Record<SearchType, { label: string; icon: typeof Users }> = {
  cliente: { label: "Cliente", icon: Users },
  visita: { label: "Visita", icon: CalendarDays },
  informe: { label: "Informe", icon: FileText },
};

const PREVIEW = 5;

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    // Below the min length the dropdown is hidden, so stale results never
    // show; we simply skip fetching (no state write needed here).
    if (debounced.length < 2) return;
    let cancelled = false;
    // Defer the loading flag to a microtask so it isn't a synchronous
    // setState during the effect body.
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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items: SearchResultItem[] = result
    ? [
        ...result.clientes.items,
        ...result.visitas.items,
        ...result.informes.items,
      ].slice(0, PREVIEW)
    : [];

  const goToResults = () => {
    if (debounced.length < 2) return;
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
          placeholder="Buscar clientes, visitas o informes…"
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {loading && items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Buscando…
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Sin resultados para “{debounced}”.
            </div>
          ) : (
            <>
              <div className="max-h-[360px] overflow-y-auto py-1">
                {items.map((item) => {
                  const Icon = typeMeta[item.type].icon;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => select(item.href)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60"
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
                      </span>
                      <span className="flex-none text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {typeMeta[item.type].label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={goToResults}
                className="block w-full border-t border-border bg-card px-3 py-2.5 text-center text-[13px] font-bold text-primary hover:bg-secondary/60"
              >
                Ver todos los resultados ({result?.total ?? 0})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

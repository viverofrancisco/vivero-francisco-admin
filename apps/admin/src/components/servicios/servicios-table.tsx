"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Search,
  Users,
  Leaf,
  Droplets,
  Scissors,
  Sprout,
  LayoutGrid,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Servicio {
  id: string;
  nombre: string;
  tipo: string;
  descripcion?: string | null;
  _count: { clientes: number };
}

/** Pick a botanical icon from keywords in the service name. */
function iconFor(nombre: string): LucideIcon {
  const n = nombre.toLowerCase();
  if (/(riego|agua|aspersor|goteo)/.test(n)) return Droplets;
  if (/(poda|seto|árbol|arbol|recorte|corte)/.test(n)) return Scissors;
  if (/(diseñ|paisaj)/.test(n)) return Sprout;
  if (/(vertical|muro|grid)/.test(n)) return LayoutGrid;
  if (/(control|fitosanitar|plaga|mecán|mecan|repar)/.test(n)) return Wrench;
  return Leaf;
}

const ITEMS_PER_PAGE = 12;

export function ServiciosTable({ servicios }: { servicios: Servicio[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = servicios;
    if (tipoFilter) {
      result = result.filter((s) => s.tipo === tipoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.nombre.toLowerCase().includes(q));
    }
    return result;
  }, [servicios, tipoFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error || "Error al eliminar");
      throw new Error(body.error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar servicio..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { value: null, label: "Todos" },
            { value: "RECURRENTE", label: "Recurrentes" },
            { value: "UNICO", label: "Únicos" },
          ].map((opt) => {
            const active = tipoFilter === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setTipoFilter(opt.value);
                  setPage(1);
                }}
                className={`h-9 rounded-xl px-4 text-[13px] font-bold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron servicios" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((servicio) => {
              const Icon = iconFor(servicio.nombre);
              const recurrente = servicio.tipo === "RECURRENTE";
              return (
                <div
                  key={servicio.id}
                  onClick={() =>
                    router.push(`/dashboard/servicios/${servicio.id}`)
                  }
                  className="flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-secondary">
                      <Icon className="h-[23px] w-[23px] text-green-700" />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${
                        recurrente
                          ? "bg-secondary text-green-700"
                          : "bg-info/12 text-info"
                      }`}
                    >
                      {recurrente ? "RECURRENTE" : "ÚNICO"}
                    </span>
                  </div>
                  <div className="mt-3.5 text-[16.5px] font-extrabold tracking-tight text-foreground">
                    {servicio.nombre}
                  </div>
                  <p className="mt-1.5 line-clamp-2 min-h-[38px] text-[13px] font-medium leading-snug text-muted-foreground">
                    {servicio.descripcion || "Sin descripción."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
                      <Users className="h-[15px] w-[15px]" />
                      {servicio._count.clientes}{" "}
                      {servicio._count.clientes === 1 ? "cliente" : "clientes"}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DeleteDialog
                        title={`¿Eliminar "${servicio.nombre}"?`}
                        description="Se eliminara este servicio permanentemente."
                        onDelete={() => handleDelete(servicio.id)}
                        onSuccess={() => router.refresh()}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(page * ITEMS_PER_PAGE, filtered.length)} de{" "}
                {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

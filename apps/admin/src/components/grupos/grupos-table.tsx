"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Search, ChevronRight } from "lucide-react";

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  _count?: { visitas: number };
  miembros: {
    personal: { nombre: string; apellido?: string | null };
  }[];
}

const ITEMS_PER_PAGE = 12;

const barColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-5",
  "bg-chart-4",
];

export function GruposTable({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return grupos;
    const q = searchQuery.toLowerCase();
    return grupos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [grupos, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron grupos" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {paginated.map((grupo, idx) => {
              const miembros = grupo.miembros ?? [];
              return (
                <div
                  key={grupo.id}
                  onClick={() => router.push(`/dashboard/grupos/${grupo.id}`)}
                  className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className={`h-11 w-3 flex-none rounded-md ${
                        barColors[idx % barColors.length]
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-extrabold tracking-tight text-foreground">
                        {grupo.nombre}
                      </div>
                      <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
                        {grupo.descripcion || "Sin descripción"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-extrabold text-foreground">
                        {grupo._count?.visitas ?? 0}
                      </div>
                      <div className="text-[11.5px] font-semibold text-muted-foreground">
                        visitas
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3.5">
                    <div className="flex items-center">
                      {miembros.slice(0, 4).map((m, i) => (
                        <div
                          key={i}
                          className="rounded-full ring-[2.5px] ring-card"
                          style={{ marginLeft: i ? -10 : 0 }}
                        >
                          <InitialsAvatar
                            name={`${m.personal.nombre} ${m.personal.apellido || ""}`.trim()}
                            size={32}
                          />
                        </div>
                      ))}
                      <span className="ml-2.5 text-[13px] font-bold text-muted-foreground">
                        {miembros.length}{" "}
                        {miembros.length === 1 ? "miembro" : "miembros"}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DeleteDialog
                        title={`¿Eliminar "${grupo.nombre}"?`}
                        description="Se eliminará este grupo permanentemente."
                        onDelete={() => handleDelete(grupo.id)}
                        onSuccess={() => router.refresh()}
                      />
                      <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
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

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { Search, ChevronRight } from "lucide-react";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  _count?: { visitas: number };
  miembros: {
    personal: { nombre: string; apellido?: string | null };
  }[];
}


const barColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-5",
  "bg-chart-4",
];

export function GruposTable({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return grupos;
    const q = searchQuery.toLowerCase();
    return grupos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [grupos, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtered.length,
    searchQuery
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    // Columna con alto propio en móvil, para que scrollee la lista y no la
    // página; en escritorio, el bloque de tarjetas de siempre.
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:block md:flex-none md:space-y-5">
      {/* Search */}
      <div className="flex flex-none flex-wrap items-center gap-3 [&_input]:h-9">
        <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
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

      {/* Tarjetas: solo en escritorio. En una columna de 400 px cada una
          ocupa media pantalla y hay que scrollear tres veces para ver cuatro
          grupos, así que ahí van como lista. */}
      {filtered.length === 0 ? (
        <div className="hidden md:block">
          <EmptyState message="No se encontraron grupos" />
        </div>
      ) : (
        <div className="hidden md:block md:space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {paginated.map((grupo, idx) => {
              const miembros = grupo.miembros ?? [];
              return (
                <div
                  key={grupo.id}
                  onClick={() =>
                    router.push(`/dashboard/grupos/${grupo.id}?from=${aca()}`)
                  }
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
          <TablePagination
            page={pagina}
            total={filtered.length}
            onPageChange={setPage}
            suelta
            sustantivo="grupo"
            plural="grupos"
          />
        </div>
      )}

      {/* Móvil: nombre y descripción, y a la derecha cuántas visitas lleva.
          Los avatares de los miembros quedan para la ficha —cuatro caras de
          32 px al lado del nombre lo dejan sin ancho— pero cuántos son sí se
          dice, que es el dato que distingue una cuadrilla de otra. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontraron grupos"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((grupo, idx) => {
          const miembros = grupo.miembros ?? [];
          return (
            <Link
              key={grupo.id}
              href={`/dashboard/grupos/${grupo.id}?from=${aqui}`}
              className={FILA_MOVIL}
            >
              <span
                className={`h-10 w-1.5 flex-none rounded-md ${
                  barColors[idx % barColors.length]
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {grupo.nombre}
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {miembros.length}{" "}
                  {miembros.length === 1 ? "miembro" : "miembros"}
                  {grupo.descripcion ? ` · ${grupo.descripcion}` : ""}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-sm font-bold tabular-nums text-foreground">
                  {grupo._count?.visitas ?? 0}
                </span>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  visitas
                </span>
              </span>
            </Link>
          );
        })}
      </ListaMovil>
    </div>
  );
}

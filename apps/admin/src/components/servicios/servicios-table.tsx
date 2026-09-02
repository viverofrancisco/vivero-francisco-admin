"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { AlertTriangle, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { aca, useFiltroUrl } from "@/lib/filtros-url";
import { fecha } from "@/components/ordenes/formato";

interface Servicio {
  id: string;
  nombre: string;
  /** Qué es: se mapea al `tipo` de Contífico (SER / PRO). */
  tipo: string;
  /** Cómo se vende. Solo existe en el portal. */
  descripcion?: string | null;
  /** Sin esto el producto no se puede vender. Se vincula desde su ficha. */
  contificoProductoId: string | null;
  /** Cuándo se archivó, o `null` si está en el catálogo. */
  archivadoEl: string | null;
  /** Cómo se agrupa en el portal. Nada que ver con la categoría de Contífico. */
  categoriaId: string | null;
  categoriaNombre: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

export function ServiciosTable({
  productos,
  categorias = [],
}: {
  productos: Servicio[];
  categorias?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [tipo, setTipo] = useFiltroUrl("tipo", "");
  const [contifico, setContifico] = useFiltroUrl("contifico", "");
  /**
   * Archivar es un borrado suave, así que el producto sigue existiendo — y
   * hasta ahora no había forma de verlo desde el portal. Por defecto se listan
   * los activos, que es lo que se está armando el 99% del tiempo.
   */
  const [archivados, setArchivados] = useFiltroUrl("archivados", "");
  const [categoria, setCategoria] = useFiltroUrl("categoria", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);

  const filtered = useMemo(() => {
    let result = productos.filter((s) =>
      archivados === "SI" ? s.archivadoEl : !s.archivadoEl
    );
    if (tipo) result = result.filter((s) => s.tipo === tipo);
    if (categoria) {
      result = result.filter((s) =>
        categoria === "SIN" ? !s.categoriaId : s.categoriaId === categoria
      );
    }
    if (contifico === "SIN") {
      result = result.filter((s) => !s.contificoProductoId);
    } else if (contifico === "CON") {
      result = result.filter((s) => s.contificoProductoId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          (s.descripcion ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [productos, archivados, tipo, categoria, contifico, searchQuery]);

  // La página se acota al renderizar: filtrar puede dejar menos páginas que la
  // actual, y así no hace falta un efecto que la corrija después de pintar.
  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error || "Error al eliminar");
      throw new Error(body.error);
    }
  };

  const restaurar = async (servicio: Servicio) => {
    const res = await fetch(`/api/servicios/${servicio.id}/restaurar`, {
      method: "POST",
    });
    const body = await res.json();
    if (!res.ok) return toast.error(body.error || "Error al restaurar");
    toast.success(`"${servicio.nombre}" vuelve al catálogo`);
    router.refresh();
  };

  /** Cualquier filtro que cambie vuelve a la primera página. */
  const cambiar = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-none flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => cambiar(() => setSearchQuery(e.target.value))}
            className="pl-9"
          />
        </div>
        <div className="w-40">
          <CustomSelect
            value={tipo}
            onChange={(v) => cambiar(() => setTipo(v))}
            options={[
              { value: "", label: "Todo tipo" },
              { value: "SERVICIO", label: "Servicio" },
              { value: "BIEN", label: "Bien" },
            ]}
            placeholder="Todo tipo"
          />
        </div>
        <div className="w-44">
          <CustomSelect
            value={contifico}
            onChange={(v) => cambiar(() => setContifico(v))}
            options={[
              { value: "", label: "Todo Contífico" },
              { value: "SIN", label: "Sin vincular" },
              { value: "CON", label: "Vinculados" },
            ]}
            placeholder="Todo Contífico"
          />
        </div>
        {categorias.length > 0 && (
          <div className="w-48">
            <CustomSelect
              value={categoria}
              onChange={(v) => cambiar(() => setCategoria(v))}
              options={[
                { value: "", label: "Toda categoría" },
                ...categorias.map((c) => ({ value: c.id, label: c.nombre })),
                { value: "SIN", label: "Sin categoría" },
              ]}
              placeholder="Toda categoría"
              searchable
              searchPlaceholder="Buscar categoría..."
            />
          </div>
        )}
        <div className="w-40">
          <CustomSelect
            value={archivados}
            onChange={(v) => cambiar(() => setArchivados(v))}
            options={[
              { value: "", label: "Activos" },
              { value: "SI", label: "Archivados" },
            ]}
            placeholder="Activos"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontraron productos" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Contífico</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((servicio) => (
                  <TableRow
                    key={servicio.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/productos/${servicio.id}?from=${aca()}`)
                    }
                  >
                    <TableCell>
                      <div className="font-medium">{servicio.nombre}</div>
                      {servicio.archivadoEl ? (
                        <div className="text-xs text-muted-foreground">
                          Archivado el {fecha(servicio.archivadoEl)}
                        </div>
                      ) : (
                        servicio.descripcion && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {servicio.descripcion}
                          </div>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {TIPO_LABEL[servicio.tipo] ?? servicio.tipo}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {servicio.categoriaNombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {servicio.contificoProductoId ? (
                        <span className="text-muted-foreground">Vinculado</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3 flex-none" />
                          Sin vincular
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {/* Archivado no se archiva de nuevo: lo que hace falta
                          ahí es la puerta de vuelta. */}
                      {servicio.archivadoEl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restaurar(servicio)}
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Restaurar
                        </Button>
                      ) : (
                        <DeleteDialog
                          title={`¿Eliminar "${servicio.nombre}"?`}
                          description="Se archiva y deja de ofrecerse. Se puede restaurar desde el filtro Archivados."
                          onDelete={() => handleDelete(servicio.id)}
                          onSuccess={() => router.refresh()}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <TablePagination
          page={pagina}
          total={filtered.length}
          onPageChange={setPage}
          sustantivo="producto"
        />
      </div>
    </div>
  );
}

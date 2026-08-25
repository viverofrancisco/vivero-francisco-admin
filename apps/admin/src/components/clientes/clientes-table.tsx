"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente, nombrePersona } from "@vivero/shared";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  referencia: string | null;
  metrosCuadrados?: number | null;
  sector?: { id: string; nombre: string } | null;
  productos?: { producto: { nombre: string } }[];
}

function fullName(cliente: Cliente): string {
  return nombreCliente(cliente);
}

export function ClientesTable({
  clientes,
  devTools = false,
}: {
  clientes: Cliente[];
  devTools?: boolean;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | "soft" | "hard">(null);
  const [deleting, setDeleting] = useState(false);
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
  const [sectorSearch, setSectorSearch] = useState("");
  const sectorDropdownRef = useRef<HTMLDivElement>(null);

  const MAX_VISIBLE_SECTORS = 6;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        sectorDropdownRef.current &&
        !sectorDropdownRef.current.contains(e.target as Node)
      ) {
        setSectorDropdownOpen(false);
        setSectorSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientes) {
      if (c.sector) map.set(c.sector.id, c.sector.nombre);
    }
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [clientes]);

  const filtered = useMemo(() => {
    let result = clientes;
    if (sectorFilter) {
      result = result.filter((c) => c.sector?.id === sectorFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          fullName(c).toLowerCase().includes(q) ||
          (c.empresa?.toLowerCase().includes(q) ?? false) ||
          (c.telefono?.includes(q) ?? false) ||
          (c.ciudad?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [clientes, sectorFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  // Top sectors by client count, for the summary strip.
  const pageIds = paginated.map((c) => c.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const runDelete = async (hard: boolean) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/clientes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), hard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      toast.success(
        hard
          ? `${data.count} cliente(s) eliminado(s) permanentemente`
          : `${data.count} cliente(s) archivado(s)`,
      );
      setConfirm(null);
      clearSelection();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa, telefono o ciudad..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        {sectors.length > 0 && (
          <div ref={sectorDropdownRef} className="relative">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSectorDropdownOpen(!sectorDropdownOpen)}
                className="min-w-[160px] justify-between"
              >
                <span className="truncate">
                  {sectorFilter
                    ? sectors.find((s) => s.id === sectorFilter)?.nombre
                    : "Todos los sectores"}
                </span>
                <ChevronDown className="ml-2 h-3 w-3 shrink-0" />
              </Button>
              {sectorFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSectorFilter(null);
                    setPage(1);
                  }}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {sectorDropdownOpen && (
              <div className="absolute z-10 mt-1 w-64 rounded-xl border bg-popover shadow-lg">
                <div className="p-2">
                  <Input
                    placeholder="Buscar sector..."
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {!sectorSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setSectorFilter(null);
                        setSectorDropdownOpen(false);
                        setSectorSearch("");
                        setPage(1);
                      }}
                      className="flex w-full px-3 py-2 text-sm hover:bg-muted text-left text-muted-foreground"
                    >
                      Todos los sectores
                    </button>
                  )}
                  {(() => {
                    const matches = sectorSearch.trim()
                      ? sectors.filter((s) =>
                          s.nombre
                            .toLowerCase()
                            .includes(sectorSearch.toLowerCase()),
                        )
                      : sectors;
                    const visible = matches.slice(0, MAX_VISIBLE_SECTORS);
                    const remaining = matches.length - visible.length;
                    return (
                      <>
                        {visible.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSectorFilter(s.id);
                              setSectorDropdownOpen(false);
                              setSectorSearch("");
                              setPage(1);
                            }}
                            className={`flex w-full px-3 py-2 text-sm hover:bg-muted text-left ${
                              sectorFilter === s.id
                                ? "bg-muted font-semibold"
                                : ""
                            }`}
                          >
                            {s.nombre}
                          </button>
                        ))}
                        {remaining > 0 && !sectorSearch.trim() && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            +{remaining} mas — busca para encontrarlos
                          </p>
                        )}
                        {matches.length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            Sin resultados
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm font-semibold">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Limpiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm("soft")}
            >
              Archivar
            </Button>
            {devTools && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirm("hard")}
              >
                Eliminar permanentemente
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Scrollean las filas, no la página: el encabezado y la paginación
          quedan siempre a la vista. El alto sale del contenedor, no de un
          `calc` a ojo que había que reajustar con cada filtro nuevo. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontraron clientes" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={togglePage}
                      aria-label="Seleccionar página"
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>m²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((cliente) => {
                  return (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/clientes/${cliente.id}`)
                      }
                    >
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected.has(cliente.id)}
                          onCheckedChange={() => toggleOne(cliente.id)}
                          aria-label={`Seleccionar ${fullName(cliente)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <InitialsAvatar name={fullName(cliente)} size={36} />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-foreground">
                              {fullName(cliente)}
                            </div>
                            {nombrePersona(cliente) && cliente.empresa ? (
                              <div className="truncate text-xs font-semibold text-muted-foreground">
                                {cliente.empresa}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.sector?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.telefono ?? "—"}
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {cliente.metrosCuadrados ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <TablePagination
          page={pagina}
          total={filtered.length}
          onPageChange={setPage}
          sustantivo="cliente"
        />
      </div>

      {/* Confirmación bulk (archivar / eliminar permanentemente) */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "hard"
                ? "Eliminar permanentemente"
                : "Archivar clientes"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "hard"
                ? `Esto borrará ${selected.size} cliente(s) y TODO lo relacionado (servicios, visitas, fotos, informes y su cuenta de acceso). Esta acción no se puede deshacer.`
                : `Se archivarán ${selected.size} cliente(s). Podrás recuperarlos.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant={confirm === "hard" ? "destructive" : "default"}
              onClick={() => runDelete(confirm === "hard")}
              disabled={deleting}
            >
              {deleting
                ? "Procesando..."
                : confirm === "hard"
                  ? "Eliminar permanentemente"
                  : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

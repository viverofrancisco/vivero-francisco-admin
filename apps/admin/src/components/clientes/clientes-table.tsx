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
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Search, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  referencia: string | null;
  metrosCuadrados?: number | null;
  sector?: { id: string; nombre: string } | null;
  servicios?: { servicio: { nombre: string } }[];
}

function fullName(cliente: Cliente): string {
  return `${cliente.nombre} ${cliente.apellido || ""}`.trim();
}

function formatUbicacion(cliente: Cliente): string {
  const parts = [cliente.sector?.nombre, cliente.ciudad].filter(Boolean);
  return parts.join(", ") || "—";
}

const ITEMS_PER_PAGE = 10;

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
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(e.target as Node)) {
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
      a.nombre.localeCompare(b.nombre)
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
          (c.telefono?.includes(q) ?? false) ||
          (c.ciudad?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [clientes, sectorFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Top sectors by client count, for the summary strip.
  const topSectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of clientes) {
      const name = c.sector?.nombre;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  }, [clientes]);

  const stats: [string, number][] = [
    ["Clientes activos", clientes.length],
    ...(topSectors.map(([n, c]) => [n, c]) as [string, number][]),
    ["Sectores", sectors.length],
  ];

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
          : `${data.count} cliente(s) archivado(s)`
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
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card px-[18px] py-[15px]"
          >
            <div className="truncate text-[13px] font-semibold text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, telefono o ciudad..."
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
                          s.nombre.toLowerCase().includes(sectorSearch.toLowerCase())
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
                              sectorFilter === s.id ? "bg-muted font-semibold" : ""
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
                          <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
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
            <Button variant="outline" size="sm" onClick={() => setConfirm("soft")}>
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

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron clientes" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={togglePage}
                      aria-label="Seleccionar página"
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>m²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((cliente) => {
                  const servicios = cliente.servicios ?? [];
                  return (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/clientes/${cliente.id}`)}
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
                            <div className="truncate text-xs font-semibold text-muted-foreground">
                              {formatUbicacion(cliente)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.sector?.nombre ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {servicios.slice(0, 2).map((s, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-bold text-green-700"
                            >
                              {s.servicio.nombre}
                            </span>
                          ))}
                          {servicios.length > 2 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">
                              +{servicios.length - 2}
                            </span>
                          )}
                          {servicios.length === 0 && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
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

      {/* Confirmación bulk (archivar / eliminar permanentemente) */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
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

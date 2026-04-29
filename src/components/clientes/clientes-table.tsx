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
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Search, ChevronDown, X } from "lucide-react";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  referencia: string | null;
  sector?: { id: string; nombre: string } | null;
}

function fullName(cliente: Cliente): string {
  return `${cliente.nombre} ${cliente.apellido || ""}`.trim();
}

function formatUbicacion(cliente: Cliente): string {
  const parts = [cliente.sector?.nombre, cliente.ciudad].filter(Boolean);
  return parts.join(", ") || "—";
}

const ITEMS_PER_PAGE = 10;

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
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

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
                  className="rounded p-1 hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
            {sectorDropdownOpen && (
              <div className="absolute z-10 mt-1 w-64 rounded-md border bg-white shadow-lg">
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
                      className="flex w-full px-3 py-2 text-sm hover:bg-gray-50 text-left text-gray-500"
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
                            className={`flex w-full px-3 py-2 text-sm hover:bg-gray-50 text-left ${
                              sectorFilter === s.id ? "bg-gray-100 font-medium" : ""
                            }`}
                          >
                            {s.nombre}
                          </button>
                        ))}
                        {remaining > 0 && !sectorSearch.trim() && (
                          <p className="px-3 py-2 text-xs text-gray-400">
                            +{remaining} mas — busca para encontrarlos
                          </p>
                        )}
                        {matches.length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
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

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron clientes" />
      ) : (
        <>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Ubicacion</TableHead>
                  <TableHead>Direccion</TableHead>
                  <TableHead className="w-16">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((cliente) => (
                  <TableRow
                    key={cliente.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/dashboard/clientes/${cliente.id}`)}
                  >
                    <TableCell className="font-medium">
                      {fullName(cliente)}
                    </TableCell>
                    <TableCell>{cliente.telefono ?? "—"}</TableCell>
                    <TableCell>{formatUbicacion(cliente)}</TableCell>
                    <TableCell>{cliente.direccion ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <DeleteDialog
                          title={`¿Eliminar a ${fullName(cliente)}?`}
                          description="Se eliminara este cliente permanentemente."
                          onDelete={() => handleDelete(cliente.id)}
                          onSuccess={() => router.refresh()}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
    </div>
  );
}

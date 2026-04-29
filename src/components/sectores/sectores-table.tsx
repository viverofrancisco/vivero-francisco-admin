"use client";

import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface SectorRow {
  id: string;
  nombre: string;
  _count: { clientes: number };
  admins: { user: AdminUser }[];
}

interface SectoresTableProps {
  sectores: SectorRow[];
}

const ITEMS_PER_PAGE = 10;

export function SectoresTable({ sectores }: SectoresTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sectores;
    const q = searchQuery.toLowerCase();
    return sectores.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [sectores, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este sector?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sectores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Sector eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar sector..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron sectores" />
      ) : (
        <>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sector</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Personal Admin</TableHead>
                  <TableHead className="w-16">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/dashboard/sectores/${s.id}`)}
                  >
                    <TableCell className="font-medium">
                      {s.nombre}
                    </TableCell>
                    <TableCell>{s._count.clientes}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.admins.length > 0 ? (
                          s.admins.map((a) => (
                            <Badge key={a.user.id} variant="secondary">
                              {a.user.name ?? a.user.email}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deleting === s.id}
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

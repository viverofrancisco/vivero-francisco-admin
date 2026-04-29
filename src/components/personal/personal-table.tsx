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
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Search } from "lucide-react";

interface Personal {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: string;
}

function fullName(p: Personal): string {
  return `${p.nombre} ${p.apellido || ""}`.trim();
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecanico";
    default:
      return tipo;
  }
}

const ITEMS_PER_PAGE = 10;

export function PersonalTable({ personal }: { personal: Personal[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = personal;
    if (estadoFilter) {
      result = result.filter((p) => p.estado === estadoFilter);
    }
    if (tipoFilter) {
      result = result.filter((p) => p.tipo === tipoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          fullName(p).toLowerCase().includes(q) ||
          (p.telefono?.includes(q) ?? false) ||
          (p.especialidad?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [personal, estadoFilter, tipoFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/personal/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, telefono o especialidad..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <CustomSelect
          value={estadoFilter ?? ""}
          onChange={(v) => {
            setEstadoFilter(v || null);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los estados" },
            { value: "ACTIVO", label: "Activos" },
            { value: "INACTIVO", label: "Inactivos" },
          ]}
          placeholder="Todos los estados"
          className="w-44"
        />
        <CustomSelect
          value={tipoFilter ?? ""}
          onChange={(v) => {
            setTipoFilter(v || null);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los tipos" },
            { value: "JARDINERO", label: "Jardineros" },
            { value: "CHOFER", label: "Choferes" },
            { value: "SUPERVISOR", label: "Supervisores" },
            { value: "MECANICO", label: "Mecanicos" },
          ]}
          placeholder="Todos los tipos"
          className="w-44"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontro personal" />
      ) : (
        <>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-16">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/dashboard/personal/${p.id}`)}
                  >
                    <TableCell className="font-medium">{fullName(p)}</TableCell>
                    <TableCell>{p.telefono ?? "—"}</TableCell>
                    <TableCell>{p.especialidad ?? "—"}</TableCell>
                    <TableCell>
                      {p.tipo ? (
                        <Badge variant="outline">{tipoLabel(p.tipo)}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.estado === "ACTIVO" ? "default" : "secondary"}>
                        {p.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <DeleteDialog
                          title={`¿Eliminar a ${fullName(p)}?`}
                          description="Se eliminara este personal permanentemente."
                          onDelete={() => handleDelete(p.id)}
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

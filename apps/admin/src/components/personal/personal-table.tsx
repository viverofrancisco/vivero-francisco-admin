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
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatCards } from "@/components/shared/stat-cards";
import { Search } from "lucide-react";

interface Personal {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: string;
  grupos?: { grupo: { nombre: string } }[];
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

/** Dot color per specialty, matching the design palette. */
function tipoDot(tipo: string | null): string {
  switch (tipo) {
    case "JARDINERO":
      return "bg-primary";
    case "SUPERVISOR":
      return "bg-clay";
    case "CHOFER":
      return "bg-info";
    default:
      return "bg-muted-foreground";
  }
}

function crewNames(p: Personal): string {
  const names = (p.grupos ?? []).map((g) => g.grupo.nombre);
  return names.length ? names.join(", ") : "—";
}

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
          (p.especialidad?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [personal, estadoFilter, tipoFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  const stats: [string, number][] = useMemo(() => {
    const activo = personal.filter((p) => p.estado === "ACTIVO").length;
    const jardineros = personal.filter((p) => p.tipo === "JARDINERO").length;
    const supervisores = personal.filter((p) => p.tipo === "SUPERVISOR").length;
    const cuadrillas = new Set(
      personal.flatMap((p) => (p.grupos ?? []).map((g) => g.grupo.nombre)),
    ).size;
    return [
      ["Personal activo", activo],
      ["Jardineros", jardineros],
      ["Supervisores", supervisores],
      ["Cuadrillas", cuadrillas],
    ];
  }, [personal]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/personal/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Summary strip */}
      <StatCards stats={stats} />

      {/* Filters */}
      <div className="flex flex-none flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

      {/* Solo las filas scrollean: encabezado y paginación quedan fijos. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontro personal" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Cuadrilla</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="w-16 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/personal/${p.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={fullName(p)} size={36} />
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">
                            {fullName(p)}
                          </div>
                          {p.tipo && (
                            <div className="truncate text-xs font-semibold text-muted-foreground">
                              {tipoLabel(p.tipo)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.tipo || p.especialidad ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
                          <span
                            className={`h-2 w-2 rounded-full ${tipoDot(p.tipo)}`}
                          />
                          {p.especialidad ?? tipoLabel(p.tipo ?? "")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {crewNames(p)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          p.estado === "ACTIVO"
                            ? "bg-secondary text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
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
          )}
        </div>

        <TablePagination
          page={pagina}
          total={filtered.length}
          onPageChange={setPage}
          sustantivo="persona"
          plural="personas"
        />
      </div>
    </div>
  );
}

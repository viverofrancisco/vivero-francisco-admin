"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { ArrowLeft, Eye, Search } from "lucide-react";
import {
  nombresProductos,
  resumenProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa: string | null;
  };
  productos: ProductoDeVisita[];
  grupo: { id: string; nombre: string } | null;
}

interface Props {
  clienteId: string;
  clienteNombre: string;
  visitas: VisitaRow[];
}


function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "secondary" as const;
    case "COMPLETADA": return "default" as const;
    case "INCOMPLETA": return "destructive" as const;
    case "CANCELADA": return "outline" as const;
    default: return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA": return "Programada";
    case "COMPLETADA": return "Completada";
    case "INCOMPLETA": return "Incompleta";
    case "CANCELADA": return "Cancelada";
    default: return estado;
  }
};

export function ClienteVisitasPage({
  clienteId,
  clienteNombre,
  visitas,
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = visitas;
    if (estadoFilter) {
      result = result.filter((v) => v.estado === estadoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          nombresProductos(v).some((n) => n.toLowerCase().includes(q)) ||
          (v.grupo?.nombre.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [visitas, estadoFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-none items-center gap-3">
        <Link href={`/dashboard/clientes/${clienteId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Visitas</h1>
          <p className="text-sm text-muted-foreground">{clienteNombre}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-none flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por servicio o grupo..."
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
            { value: "", label: "Todas" },
            { value: "PROGRAMADA", label: "Programadas" },
            { value: "COMPLETADA", label: "Completadas" },
            { value: "INCOMPLETA", label: "Incompletas" },
            { value: "CANCELADA", label: "Canceladas" },
          ]}
          placeholder="Todas"
          className="w-44"
        />
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontraron visitas" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-16">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {formatDate(v.fechaProgramada)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {resumenProductos(v)}
                    </TableCell>
                    <TableCell>{v.grupo?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={estadoBadgeVariant(v.estado)}>
                        {estadoLabel(v.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          router.push(
                            `/dashboard/visitas/${v.id}?from=/dashboard/clientes/${clienteId}/visitas`
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
          sustantivo="visita"
          plural="visitas"
        />
      </div>
    </div>
  );
}

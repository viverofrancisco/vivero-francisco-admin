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
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ClienteServicioForm } from "@/components/clientes/cliente-servicio-form";
import { ArrowLeft, Pencil, Search, Plus } from "lucide-react";

interface ServicioCatalogo {
  id: string;
  nombre: string;
  tipo: string;
}

interface Asignacion {
  id: string;
  servicioId: string;
  precio: number;
  iva: number;
  frecuenciaMensual: number | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  notas: string | null;
  servicio: ServicioCatalogo;
}

interface Props {
  clienteId: string;
  clienteNombre: string;
  asignaciones: Asignacion[];
  serviciosCatalogo: ServicioCatalogo[];
}

const ITEMS_PER_PAGE = 10;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "ACTIVO": return "default" as const;
    case "PAUSADO": return "secondary" as const;
    case "CANCELADO": return "destructive" as const;
    default: return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "ACTIVO": return "Activo";
    case "PAUSADO": return "Pausado";
    case "CANCELADO": return "Cancelado";
    default: return estado;
  }
};

export function ClienteServiciosPage({
  clienteId,
  clienteNombre,
  asignaciones,
  serviciosCatalogo,
}: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Asignacion | null>(null);

  const filtered = useMemo(() => {
    let result = asignaciones;
    if (estadoFilter) {
      result = result.filter((a) => a.estado === estadoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) =>
        a.servicio.nombre.toLowerCase().includes(q)
      );
    }
    return result;
  }, [asignaciones, estadoFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleDelete = async (asignacionId: string) => {
    const res = await fetch(
      `/api/clientes/${clienteId}/servicios/${asignacionId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Error al eliminar");
  };

  const handleEdit = (a: Asignacion) => {
    setEditData(a);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditData(null);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/clientes/${clienteId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Servicios</h1>
            <p className="text-sm text-muted-foreground">{clienteNombre}</p>
          </div>
        </div>
        <Link href="/dashboard/servicios/asignar">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Asignar Servicio
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar servicio..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {[
            { value: null, label: "Todos" },
            { value: "ACTIVO", label: "Activos" },
            { value: "PAUSADO", label: "Pausados" },
            { value: "CANCELADO", label: "Cancelados" },
          ].map((opt) => (
            <Button
              key={opt.label}
              variant={estadoFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEstadoFilter(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron servicios" />
      ) : (
        <>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.servicio.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.servicio.tipo === "RECURRENTE"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {a.servicio.tipo === "RECURRENTE"
                          ? "Recurrente"
                          : "Unico"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatPrice(a.precio)}
                      {a.iva > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          + {formatPrice(a.iva)} IVA
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.frecuenciaMensual
                        ? `${a.frecuenciaMensual}x/mes`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estadoBadgeVariant(a.estado)}>
                        {estadoLabel(a.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteDialog
                          title={`¿Quitar "${a.servicio.nombre}"?`}
                          description="Se eliminara esta asignacion de servicio."
                          onDelete={() => handleDelete(a.id)}
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

      {/* Edit dialog */}
      {editData && (
        <ClienteServicioForm
          clienteId={clienteId}
          servicios={serviciosCatalogo}
          editData={editData}
          onClose={handleClose}
          open={dialogOpen}
        />
      )}
    </>
  );
}

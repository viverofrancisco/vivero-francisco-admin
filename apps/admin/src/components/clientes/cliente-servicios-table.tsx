"use client";

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
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Pencil } from "lucide-react";

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
  servicio: {
    id: string;
    nombre: string;
    tipo: string;
  };
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return "default" as const;
    case "PAUSADO":
      return "secondary" as const;
    case "CANCELADO":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return "Activo";
    case "PAUSADO":
      return "Pausado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return estado;
  }
};

interface ClienteServiciosTableProps {
  clienteId: string;
  asignaciones: Asignacion[];
  onEdit: (asignacion: Asignacion) => void;
}

export function ClienteServiciosTable({
  clienteId,
  asignaciones,
  onEdit,
}: ClienteServiciosTableProps) {
  const router = useRouter();

  const handleDelete = async (asignacionId: string) => {
    const res = await fetch(
      `/api/clientes/${clienteId}/servicios/${asignacionId}`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error("Error al eliminar");
  };

  return (
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
          {asignaciones.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                {a.servicio.nombre}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    a.servicio.tipo === "RECURRENTE" ? "secondary" : "outline"
                  }
                >
                  {a.servicio.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
                </Badge>
              </TableCell>
              <TableCell>
                {formatPrice(a.precio)}
                {a.iva > 0 && (
                  <span className="ml-1 text-xs text-gray-400">+ {formatPrice(a.iva)} IVA</span>
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
                    onClick={() => onEdit(a)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    title={`¿Quitar "${a.servicio.nombre}"?`}
                    description="Se eliminará esta asignación de servicio."
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
  );
}

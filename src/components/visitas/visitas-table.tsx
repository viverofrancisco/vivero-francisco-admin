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

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  clienteServicio: {
    cliente: { id: string; nombre: string; apellido?: string | null };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: { id: string; nombre: string } | null;
}

const estadoBadgeVariant = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA":
      return "secondary" as const;
    case "COMPLETADA":
      return "default" as const;
    case "INCOMPLETA":
      return "destructive" as const;
    case "CANCELADA":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

const estadoLabel = (estado: string) => {
  switch (estado) {
    case "PROGRAMADA":
      return "Programada";
    case "COMPLETADA":
      return "Completada";
    case "INCOMPLETA":
      return "Incompleta";
    case "CANCELADA":
      return "Cancelada";
    default:
      return estado;
  }
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function VisitasTable({ visitas }: { visitas: VisitaRow[] }) {
  const router = useRouter();

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitas.map((v) => (
            <TableRow
              key={v.id}
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/visitas/${v.id}`)}
            >
              <TableCell>{formatDate(v.fechaProgramada)}</TableCell>
              <TableCell className="font-medium">
                {`${v.clienteServicio.cliente.nombre} ${v.clienteServicio.cliente.apellido || ""}`.trim()}
              </TableCell>
              <TableCell>{v.clienteServicio.servicio.nombre}</TableCell>
              <TableCell>{v.grupo?.nombre ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={estadoBadgeVariant(v.estado)}>
                  {estadoLabel(v.estado)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

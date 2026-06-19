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
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { nombreCliente } from "@vivero/shared";

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  clienteServicio: {
    cliente: {
      id: string;
      nombre: string;
      apellido?: string | null;
      empresa?: string | null;
    };
    servicio: { id: string; nombre: string; tipo: string };
  };
  grupo: { id: string; nombre: string } | null;
}

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
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Cuadrilla</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitas.map((v) => {
            const nombre = nombreCliente(v.clienteServicio.cliente);
            return (
              <TableRow
                key={v.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/visitas/${v.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={nombre} size={32} />
                    <span className="font-bold text-foreground">{nombre}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.clienteServicio.servicio.nombre}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.grupo?.nombre ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(v.fechaProgramada)}
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge estado={v.estado as EstadoVisitaUI} size="sm" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PERIODICIDAD_SUFIJO } from "@/components/suscripciones/formato";

export interface ServicioClienteRow {
  clienteId: string;
  nombre: string;
  sector: string | null;
  telefono: string | null;
  precio: number;
  frecuencia: number | null;
  periodicidad: string;
  estado: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    price
  );

const estadoBadge = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return { label: "Activo", className: "bg-secondary text-green-700" };
    case "PAUSADO":
      return {
        label: "Pausado",
        className: "bg-warning/15 text-warning-foreground",
      };
    case "CANCELADO":
      return {
        label: "Cancelado",
        className: "bg-destructive/10 text-destructive",
      };
    default:
      return { label: estado, className: "bg-muted text-muted-foreground" };
  }
};

export function ServicioClientesTable({
  rows,
}: {
  rows: ServicioClienteRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const goToCliente = (clienteId: string) =>
    router.push(
      `/dashboard/clientes/${clienteId}?from=${encodeURIComponent(pathname)}`
    );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">
        Clientes con este servicio ({rows.length})
      </h2>

      {rows.length === 0 ? (
        <EmptyState message="Ningún cliente tiene este producto" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Frecuencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const badge = estadoBadge(r.estado);
                return (
                  <TableRow
                    key={r.clienteId}
                    className="cursor-pointer"
                    onClick={() => goToCliente(r.clienteId)}
                  >
                    <TableCell>
                      <div className="font-bold text-foreground">{r.nombre}</div>
                      {r.sector && (
                        <div className="text-xs font-semibold text-muted-foreground">
                          {r.sector}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(r.precio)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.frecuencia
                        ? `${r.frecuencia}${PERIODICIDAD_SUFIJO[r.periodicidad] ?? ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

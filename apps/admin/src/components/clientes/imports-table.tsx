"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ImportListRow {
  id: string;
  fecha: string;
  por: string;
  status: string;
  created: number;
  skipped: number;
  failed: number;
  total: number;
}

const ESTADO_BADGE: Record<string, string> = {
  completado: "bg-secondary text-green-700",
  cancelado: "bg-warning/15 text-warning-foreground",
  procesando: "bg-muted text-muted-foreground",
};

export function ImportsTable({ imports }: { imports: ImportListRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Por</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Creados</TableHead>
            <TableHead className="text-right">Omitidos</TableHead>
            <TableHead className="text-right">Error</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((imp) => (
            <TableRow
              key={imp.id}
              onClick={() =>
                router.push(`/dashboard/clientes/importaciones/${imp.id}`)
              }
              className="cursor-pointer"
            >
              <TableCell>{imp.fecha}</TableCell>
              <TableCell className="text-muted-foreground">
                {imp.por || "—"}
              </TableCell>
              <TableCell>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                    ESTADO_BADGE[imp.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {imp.status}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium text-green-700">
                {imp.created}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {imp.skipped}
              </TableCell>
              <TableCell className="text-right text-destructive">
                {imp.failed}
              </TableCell>
              <TableCell className="text-right">{imp.total}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                <ChevronRight className="ml-auto h-4 w-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

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
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-2.5 font-medium">Fecha</th>
            <th className="px-4 py-2.5 font-medium">Por</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 font-medium text-right">Creados</th>
            <th className="px-4 py-2.5 font-medium text-right">Omitidos</th>
            <th className="px-4 py-2.5 font-medium text-right">Error</th>
            <th className="px-4 py-2.5 font-medium text-right">Total</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr
              key={imp.id}
              onClick={() =>
                router.push(`/dashboard/clientes/importaciones/${imp.id}`)
              }
              className="cursor-pointer border-t hover:bg-muted/40"
            >
              <td className="px-4 py-2.5">{imp.fecha}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {imp.por || "—"}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                    ESTADO_BADGE[imp.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {imp.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-green-700">
                {imp.created}
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                {imp.skipped}
              </td>
              <td className="px-4 py-2.5 text-right text-destructive">
                {imp.failed}
              </td>
              <td className="px-4 py-2.5 text-right">{imp.total}</td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                <ChevronRight className="ml-auto h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

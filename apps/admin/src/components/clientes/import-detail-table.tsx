"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Estado = "creado" | "omitido" | "error";

export interface ImportRowResult {
  fila: number;
  estado: Estado;
  nombre?: string;
  clienteId?: string;
  mensaje?: string;
}

type Filtro = "todos" | Estado;

const ESTADO_LABEL: Record<Estado, string> = {
  creado: "Creado",
  omitido: "Omitido",
  error: "Error",
};

const ESTADO_CLASS: Record<Estado, string> = {
  creado: "text-green-700",
  omitido: "text-muted-foreground",
  error: "text-destructive",
};

export function ImportDetailTable({ results }: { results: ImportRowResult[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const counts = useMemo(
    () => ({
      todos: results.length,
      creado: results.filter((r) => r.estado === "creado").length,
      omitido: results.filter((r) => r.estado === "omitido").length,
      error: results.filter((r) => r.estado === "error").length,
    }),
    [results]
  );

  const shown =
    filtro === "todos" ? results : results.filter((r) => r.estado === filtro);

  const tabs: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "creado", label: "Creados" },
    { key: "omitido", label: "Omitidos" },
    { key: "error", label: "Error" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFiltro(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filtro === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Fila</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-muted-foreground"
                >
                  Sin filas en esta categoría.
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.fila}>
                  <TableCell className="align-top">{r.fila}</TableCell>
                  <TableCell
                    className={cn("align-top font-medium", ESTADO_CLASS[r.estado])}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </TableCell>
                  <TableCell className="align-top">
                    {r.clienteId ? (
                      <Link
                        href={`/dashboard/clientes/${r.clienteId}`}
                        className="text-primary hover:underline"
                      >
                        {r.nombre || "Ver"}
                      </Link>
                    ) : (
                      (r.nombre ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal align-top text-muted-foreground">
                    {r.mensaje ?? ""}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fila</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Cliente</th>
              <th className="px-4 py-2.5 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Sin filas en esta categoría.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.fila} className="border-t">
                  <td className="px-4 py-2.5 align-top">{r.fila}</td>
                  <td
                    className={cn(
                      "px-4 py-2.5 align-top font-medium",
                      ESTADO_CLASS[r.estado]
                    )}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </td>
                  <td className="px-4 py-2.5 align-top">
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
                  </td>
                  <td className="px-4 py-2.5 align-top text-muted-foreground">
                    {r.mensaje ?? ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

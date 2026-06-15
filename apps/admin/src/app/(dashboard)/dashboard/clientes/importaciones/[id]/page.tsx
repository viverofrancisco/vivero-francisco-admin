import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface RowResult {
  fila: number;
  estado: "creado" | "omitido" | "error";
  nombre?: string;
  clienteId?: string;
  mensaje?: string;
}

const ESTADO_LABEL: Record<RowResult["estado"], string> = {
  creado: "Creado",
  omitido: "Omitido",
  error: "Error",
};

const ESTADO_CLASS: Record<RowResult["estado"], string> = {
  creado: "text-green-700",
  omitido: "text-muted-foreground",
  error: "text-destructive",
};

function formatFecha(d: Date) {
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ImportacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    redirect("/dashboard/clientes");
  }

  const { id } = await params;
  const imp = await prisma.clienteImport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      total: true,
      created: true,
      skipped: true,
      failed: true,
      results: true,
      createdAt: true,
      createdBy: { select: { name: true, apellido: true } },
    },
  });

  if (!imp) notFound();

  const results = (imp.results as unknown as RowResult[]) ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clientes/importaciones">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Importación — {formatFecha(imp.createdAt)}
          </h1>
          <p className="text-muted-foreground capitalize">
            {imp.status} ·{" "}
            {`${imp.createdBy?.name ?? ""} ${imp.createdBy?.apellido ?? ""}`.trim() ||
              "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-green-700">
          {imp.created} creados
        </span>
        <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-muted-foreground">
          {imp.skipped} omitidos
        </span>
        <span className="rounded-md bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
          {imp.failed} con error
        </span>
        <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-muted-foreground">
          {imp.total} total
        </span>
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
            {results.map((r) => (
              <tr key={r.fila} className="border-t">
                <td className="px-4 py-2.5 align-top">{r.fila}</td>
                <td
                  className={`px-4 py-2.5 align-top font-medium ${ESTADO_CLASS[r.estado]}`}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

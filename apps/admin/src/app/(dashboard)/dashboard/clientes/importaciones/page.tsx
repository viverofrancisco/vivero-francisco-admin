import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";

const ESTADO_BADGE: Record<string, string> = {
  completado: "bg-secondary text-green-700",
  cancelado: "bg-warning/15 text-warning-foreground",
  procesando: "bg-muted text-muted-foreground",
};

function formatFecha(d: Date) {
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ImportacionesPage() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    redirect("/dashboard/clientes");
  }

  const imports = await prisma.clienteImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      total: true,
      created: true,
      skipped: true,
      failed: true,
      createdAt: true,
      createdBy: { select: { name: true, apellido: true } },
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Importaciones de clientes
          </h1>
          <p className="text-muted-foreground">
            Historial de cargas masivas desde CSV
          </p>
        </div>
      </div>

      {imports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay importaciones.
        </p>
      ) : (
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
                <tr key={imp.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5">{formatFecha(imp.createdAt)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {`${imp.createdBy?.name ?? ""} ${imp.createdBy?.apellido ?? ""}`.trim() || "—"}
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
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/dashboard/clientes/importaciones/${imp.id}`}
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Ver <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ImportsTable } from "@/components/clientes/imports-table";

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

  const rows = imports.map((imp) => ({
    id: imp.id,
    fecha: formatFecha(imp.createdAt),
    por:
      `${imp.createdBy?.name ?? ""} ${imp.createdBy?.apellido ?? ""}`.trim(),
    status: imp.status,
    created: imp.created,
    skipped: imp.skipped,
    failed: imp.failed,
    total: imp.total,
  }));

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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay importaciones.</p>
      ) : (
        <ImportsTable imports={rows} />
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  ImportDetailTable,
  type ImportRowResult,
} from "@/components/clientes/import-detail-table";

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
      status: true,
      results: true,
      createdAt: true,
      createdBy: { select: { name: true, apellido: true } },
    },
  });

  if (!imp) notFound();

  const results = (imp.results as unknown as ImportRowResult[]) ?? [];

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

      <ImportDetailTable results={results} />
    </div>
  );
}

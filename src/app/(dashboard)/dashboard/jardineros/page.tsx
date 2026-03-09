import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { JardinerosTable } from "@/components/jardineros/jardineros-table";

export default async function JardinerosPage() {
  await requireAuth();

  const jardineros = await prisma.jardinero.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jardineros"
        description="Gestiona los jardineros del vivero"
        createHref="/dashboard/jardineros/nuevo"
        createLabel="Nuevo Jardinero"
      />

      {jardineros.length === 0 ? (
        <EmptyState message="No hay jardineros registrados" />
      ) : (
        <JardinerosTable jardineros={jardineros} />
      )}
    </div>
  );
}

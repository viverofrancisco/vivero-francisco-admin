import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GruposTable } from "@/components/grupos/grupos-table";

export default async function GruposPage() {
  await requireAuth();

  const grupos = await prisma.grupoJardinero.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      miembros: {
        include: {
          jardinero: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos de Jardineros"
        description="Gestiona los grupos de trabajo"
        createHref="/dashboard/grupos/nuevo"
        createLabel="Nuevo Grupo"
      />

      {grupos.length === 0 ? (
        <EmptyState message="No hay grupos registrados" />
      ) : (
        <GruposTable grupos={grupos} />
      )}
    </div>
  );
}

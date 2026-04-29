import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { GruposTable } from "@/components/grupos/grupos-table";

export default async function GruposPage() {
  await requireAuth();

  const grupos = await prisma.grupo.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      miembros: {
        include: {
          personal: { select: { id: true, nombre: true, apellido: true } },
        },
      },
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Grupos de Personal"
        description="Gestiona los grupos de trabajo"
        createHref="/dashboard/grupos/nuevo"
        createLabel="Nuevo Grupo"
      />

      <GruposTable grupos={grupos} />
    </div>
  );
}

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
      _count: { select: { visitas: true } },
      miembros: {
        include: {
          personal: { select: { id: true, nombre: true, apellido: true } },
        },
      },
    },
  });

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title="Grupos de Personal"
        actions={[
          {
            label: "Nuevo Grupo",
            href: "/dashboard/grupos/nuevo",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <GruposTable grupos={grupos} />
    </div>
  );
}

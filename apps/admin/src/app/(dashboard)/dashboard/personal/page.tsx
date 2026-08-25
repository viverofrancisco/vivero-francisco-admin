import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { PersonalTable } from "@/components/personal/personal-table";

export default async function PersonalPage() {
  await requireAuth();

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      grupos: { select: { grupo: { select: { nombre: true } } } },
    },
  });

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Personal"
        description="Gestiona el personal del vivero"
        actions={[
          {
            label: "Nuevo Personal",
            href: "/dashboard/personal/nuevo",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <PersonalTable personal={personal} />
    </div>
  );
}

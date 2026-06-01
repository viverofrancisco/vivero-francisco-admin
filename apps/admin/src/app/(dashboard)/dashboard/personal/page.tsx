import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { PersonalTable } from "@/components/personal/personal-table";

export default async function PersonalPage() {
  await requireAuth();

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Personal"
        description="Gestiona el personal del vivero"
        createHref="/dashboard/personal/nuevo"
        createLabel="Nuevo Personal"
      />

      <PersonalTable personal={personal} />
    </div>
  );
}

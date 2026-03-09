import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { SectoresPageClient } from "@/components/sectores/sectores-page-client";

export default async function SectoresPage() {
  await requireAdmin();

  const sectores = await prisma.sector.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { clientes: true } },
      admins: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <SectoresPageClient sectores={sectores} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrupoForm } from "@/components/grupos/grupo-form";

export default async function NuevoGrupoPage() {
  await requireAuth();

  const personalList = await prisma.personal.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <GrupoForm personalList={personalList} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrupoForm } from "@/components/grupos/grupo-form";

export default async function NuevoGrupoPage() {
  await requireAuth();

  const jardineros = await prisma.jardinero.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-6">
      <GrupoForm jardineros={jardineros} />
    </div>
  );
}

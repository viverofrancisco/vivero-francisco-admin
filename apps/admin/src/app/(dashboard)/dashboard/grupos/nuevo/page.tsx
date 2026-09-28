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
    // Sin relleno en el teléfono: el formulario trae su encabezado pegado
    // arriba, de borde a borde, y pone el suyo al cuerpo.
    <div className="md:p-6">
      <GrupoForm personalList={personalList} />
    </div>
  );
}

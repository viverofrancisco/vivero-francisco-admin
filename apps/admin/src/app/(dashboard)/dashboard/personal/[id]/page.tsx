import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { PersonalDetail } from "@/components/personal/personal-detail";

export default async function EditarPersonalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const personal = await prisma.personal.findUnique({
    where: { id, deletedAt: null },
    include: {
      grupos: {
        include: {
          grupo: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!personal) {
    notFound();
  }

  const grupos = personal.grupos.map((g) => ({
    id: g.grupo.id,
    nombre: g.grupo.nombre,
  }));

  return (
    <div>
      <PersonalDetail
        personal={{
          id: personal.id,
          nombre: personal.nombre,
          apellido: personal.apellido,
          telefono: personal.telefono,
          especialidad: personal.especialidad,
          sueldo: personal.sueldo,
          estado: personal.estado,
          tipo: personal.tipo,
          createdAt: personal.createdAt.toISOString(),
        }}
        grupos={grupos}
      />
    </div>
  );
}

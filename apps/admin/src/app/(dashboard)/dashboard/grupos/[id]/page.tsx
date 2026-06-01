import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrupoDetail } from "@/components/grupos/grupo-detail";

export default async function EditarGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const [grupo, personalList] = await Promise.all([
    prisma.grupo.findUnique({
      where: { id, deletedAt: null },
      include: {
        miembros: {
          select: { personalId: true },
        },
      },
    }),
    prisma.personal.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!grupo) {
    notFound();
  }

  return (
    <div>
      <GrupoDetail
        grupo={{
          id: grupo.id,
          nombre: grupo.nombre,
          descripcion: grupo.descripcion,
          createdAt: grupo.createdAt.toISOString(),
        }}
        miembrosIds={grupo.miembros.map(
          (m: { personalId: string }) => m.personalId
        )}
        personalList={personalList}
      />
    </div>
  );
}

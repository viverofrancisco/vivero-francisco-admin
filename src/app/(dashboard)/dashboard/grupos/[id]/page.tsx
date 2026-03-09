import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { GrupoForm } from "@/components/grupos/grupo-form";

export default async function EditarGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const [grupo, jardineros] = await Promise.all([
    prisma.grupoJardinero.findUnique({
      where: { id },
      include: {
        miembros: {
          select: { jardineroId: true },
        },
      },
    }),
    prisma.jardinero.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!grupo) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <GrupoForm
        jardineros={jardineros}
        initialData={{
          id: grupo.id,
          nombre: grupo.nombre,
          descripcion: grupo.descripcion,
          miembrosIds: grupo.miembros.map((m: { jardineroId: string }) => m.jardineroId),
        }}
      />
    </div>
  );
}

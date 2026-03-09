import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { VisitaDetail } from "@/components/visitas/visita-detail";

export default async function VisitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const visita = await prisma.visita.findUnique({
    where: { id },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true, ciudad: true, sector: { select: { nombre: true } } } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { jardinero: { select: { id: true, nombre: true } } },
          },
        },
      },
      visitaOrigen: { select: { id: true, fechaProgramada: true, estado: true } },
      visitasReagendadas: {
        select: { id: true, fechaProgramada: true, estado: true },
        orderBy: { fechaProgramada: "asc" },
      },
    },
  });

  if (!visita) {
    notFound();
  }

  const serialized = {
    ...visita,
    fechaProgramada: visita.fechaProgramada.toISOString(),
    fechaRealizada: visita.fechaRealizada?.toISOString() ?? null,
    createdAt: visita.createdAt.toISOString(),
    updatedAt: visita.updatedAt.toISOString(),
    visitaOrigen: visita.visitaOrigen
      ? {
          ...visita.visitaOrigen,
          fechaProgramada: visita.visitaOrigen.fechaProgramada.toISOString(),
        }
      : null,
    visitasReagendadas: visita.visitasReagendadas.map((vr) => ({
      ...vr,
      fechaProgramada: vr.fechaProgramada.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      <VisitaDetail visita={serialized} userRole={user.role} />
    </div>
  );
}

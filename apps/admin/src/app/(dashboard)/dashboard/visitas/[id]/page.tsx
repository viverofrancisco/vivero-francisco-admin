import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { VisitaDetail } from "@/components/visitas/visita-detail";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";

export default async function VisitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const visita = await prisma.visita.findUnique({
    where: { id, deletedAt: null },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          empresa: true,
          ciudad: true,
          sector: { select: { nombre: true } },
        },
      },
      productos: PRODUCTOS_DE_VISITA_SELECT,
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { personal: { select: { id: true, nombre: true, apellido: true } } },
          },
        },
      },
      personal: {
        where: { removedAt: null },
        include: { personal: { select: { id: true, nombre: true, apellido: true } } },
      },
      media: {
        select: { id: true, url: true, tipo: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });

  if (!visita) {
    notFound();
  }

  // Controla el botón "Ver mensajes".
  const messageCount = await prisma.visitaMessage.count({
    where: { visitaId: id },
  });
  const hasMessages = messageCount > 0;

  const serialized = {
    id: visita.id,
    fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: visita.fechaRealizada?.toISOString().split("T")[0] ?? null,
    horaEntrada: visita.horaEntrada,
    horaSalida: visita.horaSalida,
    estado: visita.estado,
    notas: visita.notas,
    notasIncompleto: visita.notasIncompleto,
    media: visita.media,
    cliente: visita.cliente,
    productos: visita.productos,
    grupo: visita.grupo,
    personal: visita.personal,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <VisitaDetail
        visita={serialized}
        userRole={user.role}
        hasMessages={hasMessages}
      />
    </div>
  );
}

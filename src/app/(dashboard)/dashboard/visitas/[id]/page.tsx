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
    where: { id, deletedAt: null },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true, ciudad: true, sector: { select: { nombre: true } } } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
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

  // Fetch all active personal for editing (only if PROGRAMADA)
  const allPersonal = visita.estado === "PROGRAMADA"
    ? await prisma.personal.findMany({
        where: { deletedAt: null, estado: "ACTIVO" },
        select: { id: true, nombre: true, apellido: true },
        orderBy: { nombre: "asc" },
      })
    : [];

  const serialized = {
    id: visita.id,
    clienteServicioId: visita.clienteServicioId,
    fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: visita.fechaRealizada?.toISOString().split("T")[0] ?? null,
    horaEntrada: visita.horaEntrada,
    horaSalida: visita.horaSalida,
    estado: visita.estado,
    notas: visita.notas,
    notasIncompleto: visita.notasIncompleto,
    media: visita.media,
    clienteServicio: {
      cliente: visita.clienteServicio.cliente,
      servicio: visita.clienteServicio.servicio,
    },
    grupo: visita.grupo,
    personal: visita.personal,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <VisitaDetail
        visita={serialized}
        userRole={user.role}
        allPersonal={allPersonal}
      />
    </div>
  );
}

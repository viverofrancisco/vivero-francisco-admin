import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ClienteVisitasPage } from "@/components/clientes/cliente-visitas-page";

export default async function ClienteVisitasRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      apellido: true,
    },
  });

  if (!cliente) {
    notFound();
  }

  const visitas = await prisma.visita.findMany({
    where: { clienteServicio: { clienteId: id }, deletedAt: null },
    orderBy: { fechaProgramada: "desc" },
    select: {
      id: true,
      fechaProgramada: true,
      fechaRealizada: true,
      estado: true,
      notas: true,
      clienteServicio: {
        select: {
          cliente: { select: { id: true, nombre: true, apellido: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: { select: { id: true, nombre: true } },
    },
  });

  const serialized = visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    notas: v.notas,
    clienteServicio: v.clienteServicio,
    grupo: v.grupo,
  }));

  const nombreCompleto = `${cliente.nombre} ${cliente.apellido || ""}`.trim();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ClienteVisitasPage
        clienteId={cliente.id}
        clienteNombre={nombreCompleto}
        visitas={serialized}
      />
    </div>
  );
}

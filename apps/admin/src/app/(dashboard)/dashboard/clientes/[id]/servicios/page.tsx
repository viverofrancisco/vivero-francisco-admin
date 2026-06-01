import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ClienteServiciosPage } from "@/components/clientes/cliente-servicios-page";

export default async function ClienteServiciosRoute({
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

  const asignaciones = await prisma.clienteServicio.findMany({
    where: { clienteId: id },
    orderBy: { createdAt: "desc" },
    include: {
      servicio: { select: { id: true, nombre: true, tipo: true } },
    },
  });

  const serviciosCatalogo = await prisma.servicio.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, tipo: true },
  });

  const serialized = asignaciones.map((a) => ({
    id: a.id,
    servicioId: a.servicioId,
    precio: Number(a.precio),
    iva: Number(a.iva),
    frecuenciaMensual: a.frecuenciaMensual,
    estado: a.estado,
    fechaInicio: a.fechaInicio.toISOString(),
    fechaFin: a.fechaFin?.toISOString() ?? null,
    notas: a.notas,
    servicio: {
      id: a.servicio.id,
      nombre: a.servicio.nombre,
      tipo: a.servicio.tipo,
    },
  }));

  const nombreCompleto = `${cliente.nombre} ${cliente.apellido || ""}`.trim();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ClienteServiciosPage
        clienteId={cliente.id}
        clienteNombre={nombreCompleto}
        asignaciones={serialized}
        serviciosCatalogo={serviciosCatalogo}
      />
    </div>
  );
}

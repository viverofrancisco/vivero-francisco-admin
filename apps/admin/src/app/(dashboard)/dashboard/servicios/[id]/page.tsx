import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServicioForm } from "@/components/servicios/servicio-form";
import { ServicioClientesTable } from "@/components/servicios/servicio-clientes-table";

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const servicio = await prisma.servicio.findUnique({ where: { id } });

  if (!servicio) {
    notFound();
  }

  const asignaciones = await prisma.clienteServicio.findMany({
    where: { servicioId: id, cliente: { deletedAt: null } },
    orderBy: [{ estado: "asc" }, { cliente: { nombre: "asc" } }],
    select: {
      precio: true,
      frecuenciaMensual: true,
      estado: true,
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          sector: { select: { nombre: true } },
        },
      },
    },
  });

  const rows = asignaciones.map((a) => ({
    clienteId: a.cliente.id,
    nombre: `${a.cliente.nombre} ${a.cliente.apellido ?? ""}`.trim(),
    sector: a.cliente.sector?.nombre ?? null,
    telefono: a.cliente.telefono,
    precio: Number(a.precio),
    frecuencia: a.frecuenciaMensual,
    estado: a.estado,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ServicioForm
        initialData={servicio}
        extra={<ServicioClientesTable rows={rows} />}
      />
    </div>
  );
}

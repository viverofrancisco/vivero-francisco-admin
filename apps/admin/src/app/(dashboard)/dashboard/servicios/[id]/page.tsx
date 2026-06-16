import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServicioDetail } from "@/components/servicios/servicio-detail";

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
    <div className="p-4 md:p-6">
      <ServicioDetail servicio={servicio} clienteRows={rows} />
    </div>
  );
}

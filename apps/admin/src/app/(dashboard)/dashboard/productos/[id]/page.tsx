import { notFound } from "next/navigation";
import { nombreCliente } from "@vivero/shared";
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

  const servicio = await prisma.producto.findUnique({ where: { id } });

  if (!servicio) {
    notFound();
  }

  // Quién tiene este producto contratado: sale de los ítems de suscripción.
  const asignaciones = await prisma.suscripcionItem.findMany({
    where: { productoId: id, suscripcion: { cliente: { deletedAt: null } } },
    orderBy: { suscripcion: { cliente: { nombre: "asc" } } },
    select: {
      precio: true,
      visitasPorPeriodo: true,
      suscripcion: {
        select: {
          estado: true,
          periodicidad: true,
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              empresa: true,
              telefono: true,
              sector: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  const rows = asignaciones.map((a) => ({
    clienteId: a.suscripcion.cliente.id,
    nombre: nombreCliente(a.suscripcion.cliente),
    sector: a.suscripcion.cliente.sector?.nombre ?? null,
    telefono: a.suscripcion.cliente.telefono,
    precio: Number(a.precio),
    frecuencia: a.visitasPorPeriodo,
    periodicidad: a.suscripcion.periodicidad as string,
    estado: a.suscripcion.estado,
  }));

  return (
    <div className="p-4 md:p-6">
      <ServicioDetail
        servicio={{
          ...servicio,
          // Decimal no cruza a un componente cliente.
          ivaTasa: servicio.ivaTasa === null ? null : Number(servicio.ivaTasa),
        }}
        clienteRows={rows}
      />
    </div>
  );
}

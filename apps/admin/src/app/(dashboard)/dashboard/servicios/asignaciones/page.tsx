import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { AsignacionesPageClient } from "@/components/servicios/asignaciones-page-client";

export default async function AsignacionesPage() {
  await requireAuth();

  const [asignaciones, servicios] = await Promise.all([
    prisma.clienteServicio.findMany({
      where: { cliente: { deletedAt: null }, servicio: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, ciudad: true } },
        servicio: { select: { id: true, nombre: true, tipo: true } },
      },
    }),
    prisma.servicio.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const serialized = asignaciones.map((a) => ({
    id: a.id,
    precio: Number(a.precio),
    iva: Number(a.iva),
    frecuenciaMensual: a.frecuenciaMensual,
    estado: a.estado,
    fechaInicio: a.fechaInicio.toISOString().split("T")[0],
    fechaFin: a.fechaFin ? a.fechaFin.toISOString().split("T")[0] : null,
    cliente: a.cliente,
    servicio: a.servicio,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <AsignacionesPageClient asignaciones={serialized} servicios={servicios} />
    </div>
  );
}

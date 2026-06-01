import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { AsignarServicioPage } from "@/components/servicios/asignar-servicio-page";

export default async function AsignarServicioRoute() {
  await requireAuth();

  const [servicios, clientes] = await Promise.all([
    prisma.servicio.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true },
    }),
    prisma.cliente.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true, ciudad: true },
    }),
  ]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <AsignarServicioPage servicios={servicios} clientes={clientes} />
    </div>
  );
}

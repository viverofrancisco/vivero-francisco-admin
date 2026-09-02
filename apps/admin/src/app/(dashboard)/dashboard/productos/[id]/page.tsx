import { notFound } from "next/navigation";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { ServicioDetail } from "@/components/servicios/servicio-detail";

export default async function EditarServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/productos");

  const servicio = await prisma.producto.findUnique({ where: { id } });

  if (!servicio) {
    notFound();
  }

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

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
        backHref={backHref}
        servicio={{
          ...servicio,
          // Decimal no cruza a un componente cliente.
          ivaTasa: servicio.ivaTasa === null ? null : Number(servicio.ivaTasa),
          // La ficha de un archivado se abre igual, pero tiene que decirlo.
          archivadoEl: servicio.deletedAt?.toISOString() ?? null,
        }}
        categorias={categorias}
        clienteRows={rows}
      />
    </div>
  );
}

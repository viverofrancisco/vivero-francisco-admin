import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ClienteDetailTabs } from "@/components/clientes/cliente-detail-tabs";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const [cliente, serviciosCatalogo, visitas] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id },
      include: {
        servicios: {
          include: { servicio: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.servicio.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true },
    }),
    prisma.visita.findMany({
      where: { clienteServicio: { clienteId: id } },
      orderBy: { fechaProgramada: "desc" },
      select: {
        id: true,
        fechaProgramada: true,
        fechaRealizada: true,
        estado: true,
        notas: true,
        clienteServicio: {
          select: {
            cliente: { select: { id: true, nombre: true } },
            servicio: { select: { id: true, nombre: true, tipo: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  if (!cliente) {
    notFound();
  }

  const asignaciones = cliente.servicios.map((a) => ({
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

  const visitasSerialized = visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada.toISOString(),
    fechaRealizada: v.fechaRealizada?.toISOString() ?? null,
    estado: v.estado,
    notas: v.notas,
    clienteServicio: v.clienteServicio,
    grupo: v.grupo,
  }));

  return (
    <div className="space-y-6">
      <ClienteDetailTabs
        cliente={{
          id: cliente.id,
          nombre: cliente.nombre,
          email: cliente.email,
          telefono: cliente.telefono,
          ciudad: cliente.ciudad,
          direccion: cliente.direccion,
          numeroCasa: cliente.numeroCasa,
          referencia: cliente.referencia,
          notas: cliente.notas,
        }}
        asignaciones={asignaciones}
        serviciosCatalogo={serviciosCatalogo}
        visitas={visitasSerialized}
      />
    </div>
  );
}

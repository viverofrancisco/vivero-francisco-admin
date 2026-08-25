import { notFound } from "next/navigation";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ClienteVisitasPage } from "@/components/clientes/cliente-visitas-page";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";

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
      empresa: true,
    },
  });

  if (!cliente) {
    notFound();
  }

  const visitas = await prisma.visita.findMany({
    where: { clienteId: id, deletedAt: null },
    orderBy: { fechaProgramada: "desc" },
    select: {
      id: true,
      fechaProgramada: true,
      fechaRealizada: true,
      estado: true,
      notas: true,
      cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
      productos: PRODUCTOS_DE_VISITA_SELECT,
      grupo: { select: { id: true, nombre: true } },
    },
  });

  const serialized = visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    notas: v.notas,
    cliente: v.cliente,
    productos: v.productos,
    grupo: v.grupo,
  }));

  const nombreCompleto = nombreCliente(cliente);

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <ClienteVisitasPage
        clienteId={cliente.id}
        clienteNombre={nombreCompleto}
        visitas={serialized}
      />
    </div>
  );
}

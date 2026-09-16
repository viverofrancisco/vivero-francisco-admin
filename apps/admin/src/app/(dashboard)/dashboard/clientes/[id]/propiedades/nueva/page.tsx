import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { nombreCliente } from "@vivero/shared";
import { PropiedadPage } from "@/components/clientes/propiedad-page";

export default async function NuevaPropiedad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [cliente, sectores] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, nombre: true, apellido: true, empresa: true },
    }),
    prisma.sector.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  if (!cliente) notFound();

  return (
    <PropiedadPage
      clienteId={cliente.id}
      clienteNombre={nombreCliente(cliente)}
      propiedad={null}
      sectores={sectores}
      backHref={`/dashboard/clientes/${cliente.id}`}
    />
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { SectorDetailClient } from "@/components/sectores/sector-detail-client";

export default async function SectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [sector, allClientes, personalAdmins] = await Promise.all([
    prisma.sector.findUnique({
      where: { id, deletedAt: null },
      include: {
        clientes: {
          where: { deletedAt: null },
          select: { id: true, nombre: true, apellido: true, ciudad: true },
          orderBy: { nombre: "asc" },
        },
        admins: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.cliente.findMany({
      where: { OR: [{ sectorId: null }, { sectorId: id }], deletedAt: null },
      select: { id: true, nombre: true, apellido: true, ciudad: true, sectorId: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PERSONAL_ADMIN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!sector) {
    notFound();
  }

  const unassignedClientes = allClientes.filter((c) => c.sectorId !== id);

  return (
    <div>
      <SectorDetailClient
        sector={sector}
        unassignedClientes={unassignedClientes}
        personalAdmins={personalAdmins}
      />
    </div>
  );
}

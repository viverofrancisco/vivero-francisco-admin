import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { SectorDetailClient } from "@/components/sectores/sector-detail-client";

export default async function SectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/sectores");

  const [sector, allClientes, personalAdmins] = await Promise.all([
    prisma.sector.findUnique({
      where: { id, deletedAt: null },
      include: {
        clientes: {
          where: { deletedAt: null },
          select: { id: true, nombre: true, apellido: true, empresa: true, ciudad: true },
          orderBy: { nombre: "asc" },
        },
        admins: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.cliente.findMany({
      where: { OR: [{ sectorId: null }, { sectorId: id }], deletedAt: null },
      select: { id: true, nombre: true, apellido: true, empresa: true, ciudad: true, sectorId: true },
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
      backHref={backHref}
        sector={sector}
        unassignedClientes={unassignedClientes}
        personalAdmins={personalAdmins}
      />
    </div>
  );
}

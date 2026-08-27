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
    // Todos los que hoy no están en este sector, con el sector donde están.
    // Incluir a los que ya tienen otro es a propósito: si solo se ofrecieran
    // los sueltos, con todos los clientes asignados —que es lo normal— el
    // botón de agregar no serviría nunca. Mover queda explícito porque el
    // diálogo dice de dónde sale cada uno.
    prisma.cliente.findMany({
      where: { deletedAt: null, NOT: { sectorId: id } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        empresa: true,
        ciudad: true,
        sector: { select: { nombre: true } },
      },
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

  return (
    <SectorDetailClient
      backHref={backHref}
      sector={sector}
      candidatos={allClientes.map(({ sector: s, ...c }) => ({
        ...c,
        sectorActual: s?.nombre ?? null,
      }))}
      personalAdmins={personalAdmins}
    />
  );
}

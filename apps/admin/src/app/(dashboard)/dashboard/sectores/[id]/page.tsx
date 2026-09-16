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

  const [sector, candidatas] = await Promise.all([
    prisma.sector.findUnique({
      where: { id, deletedAt: null },
      include: {
        // El sector agrupa lugares, no personas: es geográfico, así que es del
        // lugar donde se trabaja. El nombre del cliente viaja con su propiedad.
        propiedades: {
          where: { deletedAt: null },
          select: {
            id: true,
            nombre: true,
            direccion: true,
            ciudad: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, empresa: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    // Todas las que hoy no están en este sector, con el sector donde están.
    // Incluir a las que ya tienen otro es a propósito: si solo se ofrecieran
    // las sueltas, con todas asignadas —que es lo normal— el botón de agregar
    // no serviría nunca. Mover queda explícito porque el diálogo dice de dónde
    // sale cada una.
    prisma.propiedad.findMany({
      where: { deletedAt: null, NOT: { sectorId: id } },
      select: {
        id: true,
        nombre: true,
        direccion: true,
        ciudad: true,
        cliente: {
          select: { id: true, nombre: true, apellido: true, empresa: true },
        },
        sector: { select: { nombre: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!sector) {
    notFound();
  }

  return (
    <SectorDetailClient
      backHref={backHref}
      sector={sector}
      candidatas={candidatas.map(({ sector: s, ...p }) => ({
        ...p,
        sectorActual: s?.nombre ?? null,
      }))}
    />
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";
import { CompletarVisitaPage } from "@/components/visitas/completar-visita-page";

export default async function CompletarVisitaRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;

  // PERSONAL es solo lectura: no debería llegar ni por URL escrita a mano.
  if (user.role === "PERSONAL") notFound();

  const visita = await prisma.visita.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      numero: true,
      estado: true,
      fechaProgramada: true,
      cliente: {
        select: { nombre: true, apellido: true, empresa: true },
      },
      productos: PRODUCTOS_DE_VISITA_SELECT,
    },
  });

  if (!visita) notFound();

  return (
    <CompletarVisitaPage
      backHref={hrefDeVuelta(from, `/dashboard/visitas/${id}`)}
      visita={{
        id: visita.id,
        numero: visita.numero,
        estado: visita.estado,
        fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
        cliente: visita.cliente,
        productos: visita.productos,
      }}
    />
  );
}

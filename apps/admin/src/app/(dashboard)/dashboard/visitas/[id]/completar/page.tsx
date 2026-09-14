import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { TAREAS_DE_VISITA_INCLUDE } from "@/lib/visita-tareas";
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

  // Cerrar una visita es de oficina: el jardinero carga su parte desde la ficha
  // y nada más. No debería llegar acá ni escribiendo la URL.
  if (user.role !== "ADMIN" && user.role !== "STAFF") notFound();

  const [visita, personalList] = await Promise.all([
    prisma.visita.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaProgramada: true,
        cliente: {
          select: { nombre: true, apellido: true, empresa: true },
        },
        ...TAREAS_DE_VISITA_INCLUDE,
      },
    }),
    prisma.personal.findMany({
      where: { deletedAt: null, estado: "ACTIVO" },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

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
        tareasObligatorias: visita.tareasObligatorias,
        personal: visita.personal.map((p) => ({
          ...p,
          registradoEl: p.registradoEl?.toISOString() ?? null,
        })),
      }}
      personalList={personalList}
    />
  );
}

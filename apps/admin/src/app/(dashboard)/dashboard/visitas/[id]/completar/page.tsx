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
  /** `resultado=no-realizada` llega desde el botón *Resolver* de una novedad. */
  searchParams: Promise<{ from?: string; resultado?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { from, resultado } = await searchParams;

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
        // Lo que se reportó desde el jardín: la pantalla lo muestra y, si se
        // cierra como no realizada, propone su motivo.
        novedades: {
          orderBy: { marcadaEl: "asc" },
          include: {
            fotos: {
              select: { id: true, url: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
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
        novedades: visita.novedades.map((n) => ({
          id: n.id,
          personalId: n.personalId,
          personalNombre: n.personalNombre,
          motivo: n.motivo,
          nota: n.nota,
          fotos: n.fotos,
          marcadaEl: n.marcadaEl.toISOString(),
          recibidaEl: n.recibidaEl.toISOString(),
          sinConexion: n.sinConexion,
          lat: n.lat,
          lng: n.lng,
          precision: n.precision,
          simulada: n.simulada,
        })),
      }}
      personalList={personalList}
      resultadoInicial={resultado === "no-realizada" ? "NO_REALIZADA" : undefined}
    />
  );
}

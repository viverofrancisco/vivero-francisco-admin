import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { VisitaDetail } from "@/components/visitas/visita-detail";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";

export default async function VisitaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  // Solo rutas internas del dashboard: evita un open redirect.
  const backHref =
    from && from.startsWith("/dashboard/") ? from : "/dashboard/visitas";

  const visita = await prisma.visita.findUnique({
    where: { id, deletedAt: null },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          empresa: true,
          ciudad: true,
          sector: { select: { nombre: true } },
        },
      },
      productos: PRODUCTOS_DE_VISITA_SELECT,
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { personal: { select: { id: true, nombre: true, apellido: true } } },
          },
        },
      },
      personal: {
        where: { removedAt: null },
        include: { personal: { select: { id: true, nombre: true, apellido: true } } },
      },
      media: {
        select: { id: true, url: true, tipo: true, productoId: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });

  if (!visita) {
    notFound();
  }

  // Para etiquetar una foto con algo que no se agendó: en el campo aparece de
  // todo, y el informe arma secciones con cualquier producto del catálogo.
  const catalogo = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  // Controla el botón "Ver mensajes".
  const messageCount = await prisma.visitaMessage.count({
    where: { visitaId: id },
  });
  const hasMessages = messageCount > 0;

  const serialized = {
    id: visita.id,
    numero: visita.numero,
    fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: visita.fechaRealizada?.toISOString().split("T")[0] ?? null,
    horaEntrada: visita.horaEntrada,
    horaSalida: visita.horaSalida,
    estado: visita.estado,
    notas: visita.notas,
    notasIncompleto: visita.notasIncompleto,
    media: visita.media,
    cliente: visita.cliente,
    productos: visita.productos,
    grupo: visita.grupo,
    personal: visita.personal,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <VisitaDetail
        backHref={backHref}
        visita={serialized}
        userRole={user.role}
        hasMessages={hasMessages}
        catalogo={catalogo.map((p) => ({
          productoId: p.id,
          nombre: p.nombre,
        }))}
      />
    </div>
  );
}

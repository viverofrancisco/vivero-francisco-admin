import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { VisitaDetail } from "@/components/visitas/visita-detail";
import { TAREAS_DE_VISITA_INCLUDE } from "@/lib/visita-tareas";

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
      ...TAREAS_DE_VISITA_INCLUDE,
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { personal: { select: { id: true, nombre: true, apellido: true } } },
          },
        },
      },
      media: {
        select: { id: true, url: true, tipo: true, tareaId: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });

  if (!visita) {
    notFound();
  }

  // El catálogo de tareas, para etiquetar las fotos. Va completo: en el campo
  // se fotografía lo que aparece —un problema de riego durante una poda— y esa
  // foto igual merece su sección en el informe.
  const catalogo = await prisma.tarea.findMany({
    where: { deletedAt: null },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  // Solo para la oficina: al jardinero no le llega ni con la visita cargada.
  // Se pide acá y no dentro del componente porque el componente es de cliente y
  // no debe poder pedirla él.
  const esOficina = user.role === "ADMIN" || user.role === "STAFF";
  const calificacion = esOficina
    ? await prisma.calificacionVisita.findUnique({
        where: { visitaId: id },
        select: {
          estrellas: true,
          comentario: true,
          createdAt: true,
          fotos: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  const serialized = {
    id: visita.id,
    numero: visita.numero,
    fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: visita.fechaRealizada?.toISOString().split("T")[0] ?? null,
    // Con hora: son instantes, no días. Y el nombre es el guardado en su
    // momento, no el que tenga hoy esa cuenta —o el de nadie, si se eliminó.
    completadaEl: visita.completadaEl?.toISOString() ?? null,
    completadaPorNombre: visita.completadaPorNombre,
    actualizadaEl: visita.updatedAt.toISOString(),
    actualizadaPorNombre: visita.updatedByNombre,
    horaEntrada: visita.horaEntrada,
    horaSalida: visita.horaSalida,
    estado: visita.estado,
    notas: visita.notas,
    notasIncompleto: visita.notasIncompleto,
    media: visita.media,
    cliente: visita.cliente,
    grupo: visita.grupo,
    tareasObligatorias: visita.tareasObligatorias,
    // Los partes de cada uno, con la fecha como texto para que crucen el
    // límite servidor→cliente.
    personal: visita.personal.map((p) => ({
      ...p,
      registradoEl: p.registradoEl?.toISOString() ?? null,
      entradaEl: p.entradaEl?.toISOString() ?? null,
      salidaEl: p.salidaEl?.toISOString() ?? null,
    })),
    calificacion: calificacion && {
      ...calificacion,
      createdAt: calificacion.createdAt.toISOString(),
    },
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <VisitaDetail
        backHref={backHref}
        visita={serialized}
        userRole={user.role}
        personalId={user.personalId ?? null}
        catalogo={catalogo.map((t) => ({
          tareaId: t.id,
          nombre: t.nombre,
        }))}
      />
    </div>
  );
}

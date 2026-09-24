import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { SinAcceso } from "@/components/shared/sin-acceso";
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
        },
      },
      // Dónde pasa. La dirección y el sector son del lugar, no de la persona.
      propiedad: {
        select: {
          id: true,
          nombre: true,
          direccion: true,
          numeroCasa: true,
          ciudad: true,
          referencia: true,
          lat: true,
          lng: true,
          // Lo que hay que mantener ahí: es con lo que se cotiza, y quien abre
          // la visita es quien tiene que saberlo.
          m2Total: true,
          m2Cesped: true,
          numeroArboles: true,
          mlVegetacionBaja: true,
          mlVegetacionMedia: true,
          mlVegetacionAlta: true,
          jardinerasPlantaAlta: true,
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

  // Un jardinero ve solo las visitas que le tocaron. Las listas, el buscador
  // y la API ya lo cumplían; esta página solo pedía sesión, y una tarjeta
  // compartida en el chat es justamente una URL a una visita ajena.
  if (
    user.role === "PERSONAL" &&
    !visita.personal.some((p) => p.personalId === user.personalId)
  ) {
    return <SinAcceso tipo="visita" backHref={backHref} />;
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
    propiedad: visita.propiedad,
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

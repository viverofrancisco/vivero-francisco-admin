import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tareasHechas } from "@/lib/visita-tareas";
import { requireAuth, viewerFromUser } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import {
  UBICACION_DE_PROPIEDAD,
  getSuscripcion,
  ordenesDeSuscripcion,
  visitasDeSuscripcion,
} from "@/lib/services/suscripcion.service";
import { NotFoundError } from "@/lib/services/errors";
import { SuscripcionDetail } from "@/components/suscripciones/suscripcion-detail";

export default async function SuscripcionRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireAuth();
  const viewer = viewerFromUser(user);
  const { id } = await params;

  /**
   * Quien no ve plata entra a ver de qué se trata el plan —de qué propiedad
   * es y cuántas visitas por período— porque es lo que necesita para agendar.
   * No ve precios ni órdenes, y no puede cambiar nada: el plan es un acuerdo
   * comercial y se toca desde la oficina.
   */
  const soloLectura = !isAdminRole(user.role);
  const { from } = await searchParams;
  // Solo rutas internas del dashboard: evita un open redirect.
  const backHref =
    from && from.startsWith("/dashboard/") ? from : "/dashboard/suscripciones";

  let suscripcion;
  try {
    suscripcion = await getSuscripcion(viewer, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [ordenes, visitas, propiedades] = await Promise.all([
    // `ordenesDeSuscripcion` rechaza a quien no ve plata, así que ni se pide.
    soloLectura ? Promise.resolve([]) : ordenesDeSuscripcion(viewer, id),
    visitasDeSuscripcion(viewer, id),
    // Entre cuáles se puede mover el plan: las propiedades vivas del cliente,
    // con su ubicación, para mostrarla debajo del selector al cambiarla.
    prisma.propiedad.findMany({
      where: { clienteId: suscripcion.cliente.id, deletedAt: null },
      select: UBICACION_DE_PROPIEDAD,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-6">
      <SuscripcionDetail
        soloLectura={soloLectura}
        backHref={backHref}
        visitas={visitas.map((v) => ({
          id: v.id,
          numero: v.numero,
          fechaProgramada: v.fechaProgramada.toISOString(),
          fechaRealizada: v.fechaRealizada?.toISOString() ?? null,
          estado: v.estado,
          tareas: tareasHechas({
            tareasObligatorias: v.tareasObligatorias,
            personal: v.personal,
          }).map((t) => t.nombre),
        }))}
        ordenes={ordenes.map((o) => ({
          ...o,
          fecha: o.fecha.toISOString(),
          periodoInicio: o.periodoInicio?.toISOString() ?? null,
          periodoFin: o.periodoFin?.toISOString() ?? null,
        }))}
        suscripcion={{
          id: suscripcion.id,
          numero: suscripcion.numero,
          estado: suscripcion.estado,
          periodicidad: suscripcion.periodicidad,
          fechaInicio: suscripcion.fechaInicio.toISOString(),
          notas: suscripcion.notas,
          // Los precios no salen del servidor para quien no los ve.
          precio: soloLectura ? 0 : Number(suscripcion.precio),
          ivaTasa: soloLectura ? 0 : Number(suscripcion.ivaTasa),
          visitasPorPeriodo: suscripcion.visitasPorPeriodo,
          cliente: {
            id: suscripcion.cliente.id,
            nombre: suscripcion.cliente.nombre,
            apellido: suscripcion.cliente.apellido,
            empresa: suscripcion.cliente.empresa,
          },
          propiedad: suscripcion.propiedad,
          // La del plan siempre está, aunque después la hayan eliminado: si
          // no, el desplegable mostraría vacío un plan que sí tiene propiedad.
          propiedades: propiedades.some((p) => p.id === suscripcion.propiedad.id)
            ? propiedades
            : [suscripcion.propiedad, ...propiedades],
        }}
      />
    </div>
  );
}

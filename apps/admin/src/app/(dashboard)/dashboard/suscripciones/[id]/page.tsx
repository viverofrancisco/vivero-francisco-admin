import { notFound } from "next/navigation";
import { requireAuth, viewerFromUser } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import {
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
   * Un admin de sector entra a ver de qué se trata el plan —qué cubre y
   * cuántas visitas por período— porque es lo que necesita para agendar. No ve
   * precios ni órdenes, y no puede cambiar nada: el plan es un acuerdo
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

  // Ninguna de las dos es una relación directa: a las órdenes se llega por las
  // líneas que citan alguno de sus ítems, y a las visitas por los
  // `VisitaProducto` marcados como cubiertos por esos mismos ítems.
  const [ordenes, visitas] = await Promise.all([
    // `ordenesDeSuscripcion` rechaza a quien no ve plata, así que ni se pide.
    soloLectura ? Promise.resolve([]) : ordenesDeSuscripcion(viewer, id),
    visitasDeSuscripcion(viewer, id),
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
          productos: v.productos,
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
          cliente: {
            id: suscripcion.cliente.id,
            nombre: suscripcion.cliente.nombre,
            apellido: suscripcion.cliente.apellido,
            empresa: suscripcion.cliente.empresa,
          },
          items: suscripcion.items.map((i) => ({
            id: i.id,
            productoId: i.productoId,
            nombre: i.producto.nombre,
            // Los precios no salen del servidor para quien no los ve.
            precio: soloLectura ? 0 : Number(i.precio),
            ivaTasa: soloLectura ? 0 : Number(i.ivaTasa),
            visitasPorPeriodo: i.visitasPorPeriodo,
          })),
        }}
      />
    </div>
  );
}

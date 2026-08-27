import { notFound } from "next/navigation";
import { requireStaff, viewerFromUser } from "@/lib/auth-helpers";
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
  // La ficha muestra precios, totales y las órdenes del plan, y desde acá se
  // editan: es una pantalla de facturación. Un admin de sector ve la lista
  // para saber qué tiene contratado cada cliente, y hasta ahí.
  const viewer = viewerFromUser(await requireStaff());
  const { id } = await params;
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
    ordenesDeSuscripcion(viewer, id),
    visitasDeSuscripcion(viewer, id),
  ]);

  return (
    <div className="p-4 md:p-6">
      <SuscripcionDetail
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
            precio: Number(i.precio),
            ivaTasa: Number(i.ivaTasa),
            visitasPorPeriodo: i.visitasPorPeriodo,
          })),
        }}
      />
    </div>
  );
}

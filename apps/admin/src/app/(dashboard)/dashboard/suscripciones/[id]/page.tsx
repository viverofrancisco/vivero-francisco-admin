import { notFound } from "next/navigation";
import { viewerFromSession } from "@/lib/auth-helpers";
import { getSuscripcion } from "@/lib/services/suscripcion.service";
import { listarFacturas } from "@/lib/services/factura.service";
import { NotFoundError } from "@/lib/services/errors";
import { SuscripcionDetail } from "@/components/suscripciones/suscripcion-detail";

export default async function SuscripcionRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const viewer = await viewerFromSession();
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

  // No hay relación directa: se llega por las líneas de orden que citan
  // alguno de sus ítems.
  const { items: facturas } = await listarFacturas(viewer, {
    suscripcionId: id,
  });

  return (
    <div className="p-4 md:p-6">
      <SuscripcionDetail
        backHref={backHref}
        facturas={facturas.map((f) => ({
          id: f.id,
          numero: f.numero,
          fechaEmision: f.fechaEmision.toISOString(),
          estado: f.estado,
          total: Number(f.total),
          saldo: f.saldo === null ? null : Number(f.saldo),
          urlRide: f.urlRide,
          anulada: f.anulada,
          razonSocial: f.razonSocial,
          identificacion: f.identificacion,
          orden: { id: f.orden.id, numero: f.orden.numero, cliente: f.orden.cliente },
        }))}
        suscripcion={{
          id: suscripcion.id,
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

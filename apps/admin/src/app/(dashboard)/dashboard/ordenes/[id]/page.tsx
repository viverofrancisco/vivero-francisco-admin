import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserSectorIds, viewerFromSession } from "@/lib/auth-helpers";
import { getOrden } from "@/lib/services/orden.service";
import { NotFoundError } from "@/lib/services/errors";
import { OrdenDetail } from "@/components/ordenes/orden-detail";

export default async function OrdenRoute({
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
    from && from.startsWith("/dashboard/") ? from : "/dashboard/ordenes";

  let orden;
  try {
    orden = await getOrden(viewer, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // Solo hace falta para poder cambiar de cliente en un borrador.
  const clientes =
    orden.estado === "BORRADOR"
      ? await prisma.cliente.findMany({
          where: {
            deletedAt: null,
            ...(viewer.role === "PERSONAL_ADMIN"
              ? { sectorId: { in: await getUserSectorIds(viewer.id) } }
              : {}),
          },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, apellido: true, empresa: true },
        })
      : [];

  // Sin datos de facturación no se puede emitir: se avisa en la pantalla.
  const datosFacturacion = await prisma.datoFacturacion.count({
    where: { clienteId: orden.cliente.id, archivado: false },
  });

  // El catálogo solo hace falta para editar el borrador.
  const productos =
    orden.estado === "BORRADOR"
      ? await prisma.producto.findMany({
          where: { deletedAt: null },
          orderBy: { nombre: "asc" },
          select: {
            id: true,
            nombre: true,
            ivaTasa: true,
            contificoProductoId: true,
          },
        })
      : [];

  return (
    <div className="p-4 md:p-6">
      <OrdenDetail
        backHref={backHref}
        orden={{
          id: orden.id,
          numero: orden.numero,
          fecha: orden.fecha.toISOString(),
          createdAt: orden.createdAt.toISOString(),
          estado: orden.estado,
          notas: orden.notas,
          datoFacturacionId: orden.datoFacturacionId,
          subtotal: Number(orden.subtotal),
          iva: Number(orden.iva),
          total: Number(orden.total),
          cliente: {
            id: orden.cliente.id,
            nombre: orden.cliente.nombre,
            apellido: orden.cliente.apellido,
            empresa: orden.cliente.empresa,
            datosFacturacion: datosFacturacion,
          },
          visita: orden.visita
            ? {
                id: orden.visita.id,
                numero: orden.visita.numero,
                fecha: orden.visita.fechaProgramada.toISOString(),
              }
            : null,
          suscripcion: orden.suscripcion,
          lineas: orden.lineas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: Number(l.cantidad),
            precioUnitario: Number(l.precioUnitario),
            ivaTasa: Number(l.ivaTasa),
            total: Number(l.total),
            periodoInicio: l.periodoInicio?.toISOString() ?? null,
            periodoFin: l.periodoFin?.toISOString() ?? null,
            productoId: l.productoId,
            visitaProductoId: l.visitaProductoId,
            suscripcionItemId: l.suscripcionItemId,
            suscripcionId: l.suscripcionItem?.suscripcionId ?? null,
            visita: l.visitaProducto
              ? {
                  id: l.visitaProducto.visita.id,
                  fecha: l.visitaProducto.visita.fechaProgramada.toISOString(),
                }
              : null,
          })),
          facturas: orden.facturas.map((f) => ({
            id: f.id,
            numero: f.numero,
            estado: f.estado,
            fechaEmision: f.fechaEmision.toISOString(),
            urlRide: f.urlRide,
            total: Number(f.total),
            anulada: f.anulada,
            saldo: f.saldo === null ? null : Number(f.saldo),
            razonSocial: f.razonSocial,
            identificacion: f.identificacion,
            contificoDocumentoId: f.contificoDocumentoId,
            createdAt: f.createdAt.toISOString(),
            datoFacturacion: f.datoFacturacion,
          })),
        }}
        clientes={clientes}
        productos={productos.map((p) => ({
          ...p,
          ivaTasa: p.ivaTasa === null ? null : Number(p.ivaTasa),
        }))}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserSectorIds, viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import {
  getOrden,
  listarPendientes,
  VISITAS_SIN_TOPE,
} from "@/lib/services/orden.service";
import { hoyEnEcuador } from "@/lib/fechas";
import { NotFoundError } from "@/lib/services/errors";
import { OrdenDetail } from "@/components/ordenes/orden-detail";

export default async function OrdenRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireStaff();
  const viewer = await viewerFromSession();
  const { id } = await params;
  const { from } = await searchParams;
  // Solo rutas internas del dashboard: evita un open redirect.
  const backHref =
    from && from.startsWith("/dashboard/") ? from : "/dashboard/ordenes";

  const hoy = hoyEnEcuador();

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

  // El trabajo que el editor puede marcar y desmarcar: lo pendiente del cliente
  // **más lo que esta orden ya cubre**, que si no desaparecería de la lista.
  // Las visitas no se cortan por fecha; los períodos de plan sí (fin de mes).
  const finDeMes = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)
  );
  const pendientes =
    orden.estado === "BORRADOR"
      ? await listarPendientes(
          viewer,
          orden.cliente.id,
          new Date(Date.UTC(2000, 0, 1)),
          finDeMes,
          VISITAS_SIN_TOPE,
          orden.id
        )
      : [];

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
          visitas: orden.visitas.map((v) => ({
            id: v.visita.id,
            numero: v.visita.numero,
            fecha: v.visita.fechaProgramada.toISOString(),
          })),
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
            // Si el producto puede salir impreso tal cual. Sale de la línea y
            // no del catálogo de al lado: ese solo se carga para editar un
            // borrador, y uno dado de baja tampoco estaría ahí.
            productoVinculado: l.producto.contificoProductoId !== null,
            visitaProductoIds: l.origenes.map((o) => o.visitaProductoId),
            suscripcionItemId: l.suscripcionItemId,
            suscripcionId: l.suscripcionItem?.suscripcionId ?? null,
            /** De qué visitas sale la línea. Varias si el mismo producto se hizo en más de una. */
            visitas: l.origenes.map((o) => ({
              id: o.visitaProducto.visita.id,
              numero: o.visitaProducto.visita.numero,
              fecha: o.visitaProducto.visita.fechaProgramada.toISOString(),
            })),
          })),
          facturas: orden.facturas.map((f) => ({
            id: f.id,
            numero: f.numero,
            tipo: f.tipo,
            estado: f.estado,
            lineas: f.lineas.map((l) => ({
              id: l.id,
              descripcion: l.descripcion,
              detalle: l.detalle,
              cantidad: Number(l.cantidad),
              precioUnitario: Number(l.precioUnitario),
              ivaTasa: Number(l.ivaTasa),
              total: Number(l.total),
            })),
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
        pendientes={pendientes.map((p) =>
          p.tipo === "visita"
            ? {
                tipo: "visita" as const,
                productoId: p.productoId,
                descripcion: p.descripcion,
                precio: String(p.precio),
                ivaTasa: String(p.ivaTasa),
                visitaProductoId: p.visitaProductoId,
                visitaId: p.visitaId,
                visitaNumero: p.visitaNumero,
                fecha: p.fecha.toISOString(),
              }
            : {
                tipo: "suscripcion" as const,
                productoId: p.productoId,
                descripcion: p.descripcion,
                precio: String(p.precio),
                ivaTasa: String(p.ivaTasa),
                suscripcionItemId: p.suscripcionItemId,
                suscripcionId: p.suscripcionId,
                periodoInicio: p.periodoInicio.toISOString(),
                periodoFin: p.periodoFin.toISOString(),
              }
        )}
      />
    </div>
  );
}

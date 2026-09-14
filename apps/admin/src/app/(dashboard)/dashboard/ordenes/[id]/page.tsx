import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  TAREAS_DE_VISITA_INCLUDE,
  tareasHechas,
} from "@/lib/visita-tareas";
import { viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import {
  getOrden,
} from "@/lib/services/orden.service";
import { NotFoundError } from "@/lib/services/errors";
import { productosVendibles } from "@/lib/services/variantes-vendibles";
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
          where: { deletedAt: null },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, apellido: true, empresa: true },
        })
      : [];

  // Sin datos de facturación no se puede emitir: se avisa en la pantalla.
  const datosFacturacion = await prisma.datoFacturacion.count({
    where: { clienteId: orden.cliente.id, archivado: false },
  });

  // Las visitas del cliente, para poder decir de cuáles es la orden. Es traza:
  // marcar una no carga ninguna línea.
  const visitasDelCliente =
    orden.estado === "BORRADOR"
      ? await prisma.visita.findMany({
          where: {
            clienteId: orden.cliente.id,
            deletedAt: null,
            estado: { not: "CANCELADA" },
          },
          select: {
            id: true,
            numero: true,
            fechaProgramada: true,
            ...TAREAS_DE_VISITA_INCLUDE,
          },
          orderBy: { fechaProgramada: "desc" },
          take: 60,
        })
      : [];

  // El catálogo solo hace falta para editar el borrador. Viene con sus
  // variantes: un bien se vende por variante, y el editor tiene que poder
  // ofrecerlas sin volver al servidor.
  const productos =
    orden.estado === "BORRADOR"
      ? await productosVendibles({ limit: 20 })
      : { items: [], hayMas: false };

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
            varianteId: l.varianteId,
            suscripcionItemId: l.suscripcionItemId,
            suscripcionId: l.suscripcionItem?.suscripcionId ?? null,
          })),
          facturas: orden.facturas.map((f) => ({
            id: f.id,
            numero: f.numero,
            tipo: f.tipo,
            estado: f.estado,
            lineas: f.lineas.map((l) => ({
              id: l.id,
              descripcion: l.descripcion,
              cantidad: Number(l.cantidad),
              precioUnitario: Number(l.precioUnitario),
              ivaTasa: Number(l.ivaTasa),
              total: Number(l.total),
            })),
            fechaEmision: f.fechaEmision.toISOString(),
            total: Number(f.total),
            anulada: f.anulada,
            saldo: f.saldo === null ? null : Number(f.saldo),
            razonSocial: f.razonSocial,
            identificacion: f.identificacion,
            claveAcceso: f.claveAcceso,
            motivo: f.motivo,
            facturaModificadaId: f.facturaModificadaId,
            enviadoEl: f.enviadoEl?.toISOString() ?? null,
            enviadoA: f.enviadoA,
            ambienteSri: f.ambienteSri,
            estadoSri: f.estadoSri,
            mensajesSri: f.mensajesSri as
              | { identificador?: string; mensaje?: string; informacionAdicional?: string; tipo?: string }[]
              | null,
            createdAt: f.createdAt.toISOString(),
            datoFacturacion: f.datoFacturacion,
          })),
        }}
        clientes={clientes}
        productos={productos.items}
        hayMasProductos={productos.hayMas}
        visitasDelCliente={visitasDelCliente.map((v) => ({
          id: v.id,
          numero: v.numero,
          fecha: v.fechaProgramada.toISOString(),
          tareas: tareasHechas(v).map((t) => t.nombre),
        }))}
      />
    </div>
  );
}

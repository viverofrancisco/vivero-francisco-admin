import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { getOrden } from "@/lib/services/orden.service";
import { NotFoundError } from "@/lib/services/errors";
import { EmitirFacturaPage } from "@/components/ordenes/emitir-factura-page";

/**
 * Armar y emitir el documento de una orden.
 *
 * Pantalla propia y no un diálogo: acá se decide qué sale impreso, que puede no
 * ser lo que dice la orden, y eso necesita ver las dos cosas al mismo tiempo.
 */
export default async function EmitirRoute({
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
    from && from.startsWith("/dashboard/") ? from : `/dashboard/ordenes/${id}`;

  let orden;
  try {
    orden = await getOrden(viewer, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // Una orden con factura viva no se vuelve a emitir, y una anulada no se
  // emite: se vuelve a la orden, que es donde se ve por qué.
  const vigente = orden.facturas.find((f) => !f.anulada);
  if (vigente || orden.estado === "ANULADA") {
    redirect(`/dashboard/ordenes/${id}`);
  }

  const [productos, datosFacturacion] = await Promise.all([
    prisma.producto.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        ivaTasa: true,
        contificoProductoId: true,
      },
    }),
    prisma.datoFacturacion.findMany({
      where: { clienteId: orden.cliente.id, archivado: false },
      orderBy: [{ esPredeterminado: "desc" }, { razonSocial: "asc" }],
    }),
  ]);

  return (
    <EmitirFacturaPage
      backHref={backHref}
      orden={{
        id: orden.id,
        numero: orden.numero,
        fecha: orden.fecha.toISOString(),
        subtotal: Number(orden.subtotal),
        iva: Number(orden.iva),
        total: Number(orden.total),
        cliente: {
          id: orden.cliente.id,
          nombre: orden.cliente.nombre,
          apellido: orden.cliente.apellido,
          empresa: orden.cliente.empresa,
        },
        lineas: orden.lineas.map((l) => ({
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precioUnitario),
          ivaTasa: Number(l.ivaTasa),
          productoId: l.productoId,
        })),
      }}
      productos={productos.map((p) => ({
        ...p,
        ivaTasa: p.ivaTasa === null ? null : Number(p.ivaTasa),
      }))}
      datosFacturacion={datosFacturacion.map((d) => ({
        id: d.id,
        tipoIdentificacion: d.tipoIdentificacion,
        identificacion: d.identificacion,
        razonSocial: d.razonSocial,
        esPredeterminado: d.esPredeterminado,
        tipoPersona: d.tipoPersona,
        direccion: d.direccion,
        telefono: d.telefono,
        email: d.email,
      }))}
    />
  );
}

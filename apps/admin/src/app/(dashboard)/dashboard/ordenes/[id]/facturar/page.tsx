import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { getOrden } from "@/lib/services/orden.service";
import { NotFoundError } from "@/lib/services/errors";
import { emisoresDisponibles } from "@/lib/services/emisor.service";
import { productosVendibles } from "@/lib/services/variantes-vendibles";
import { EmitirFacturaPage } from "@/components/ordenes/emitir-factura-page";
import { facturaVigenteDe } from "@/lib/services/factura-vigente";

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
  const vigente = facturaVigenteDe(orden.facturas);
  if (vigente || orden.estado === "ANULADA") {
    redirect(`/dashboard/ordenes/${id}`);
  }

  const [tandaProductos, datosFacturacion, emisores] = await Promise.all([
    // Con sus variantes: de la variante sale el SKU impreso y el stock que
    // baja cuando el SRI autoriza.
    productosVendibles({ limit: 20 }),
    prisma.datoFacturacion.findMany({
      where: { clienteId: orden.cliente.id, archivado: false },
      orderBy: [{ esPredeterminado: "desc" }, { razonSocial: "asc" }],
    }),
    // Con qué RUC se puede emitir. Vacío mientras no haya ninguno configurado
    // con su firma, y entonces la pantalla lo dice y no deja emitir.
    emisoresDisponibles(viewer),
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
          varianteId: l.varianteId,
        })),
      }}
      productos={tandaProductos.items}
      hayMasProductos={tandaProductos.hayMas}
      emisores={emisores.map((e) => ({
        id: e.id,
        ruc: e.ruc,
        razonSocial: e.razonSocial,
        ambiente: e.ambiente,
        predeterminado: e.predeterminado,
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

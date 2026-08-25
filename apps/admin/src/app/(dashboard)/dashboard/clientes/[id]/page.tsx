import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, viewerFromUser } from "@/lib/auth-helpers";
import { listarOrdenes } from "@/lib/services/orden.service";
import { ClienteDetailTabs } from "@/components/clientes/cliente-detail-tabs";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  // Solo permitimos volver a rutas internas del dashboard (evita open redirect).
  const backHref = from && from.startsWith("/dashboard/") ? from : "/dashboard/clientes";

  const [cliente, visitas] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id, deletedAt: null },
      include: {
        sector: { select: { id: true, nombre: true } },
        datosFacturacion: {
          where: { archivado: false },
          orderBy: [{ esPredeterminado: "desc" }, { createdAt: "asc" }],
        },
        suscripciones: {
          where: { estado: { not: "CANCELADO" } },
          include: { items: { include: { producto: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.visita.findMany({
      where: { clienteId: id, deletedAt: null },
      orderBy: { fechaProgramada: "desc" },
      select: {
        id: true,
        fechaProgramada: true,
        fechaRealizada: true,
        estado: true,
        notas: true,
        cliente: { select: { id: true, nombre: true, apellido: true } },
        productos: PRODUCTOS_DE_VISITA_SELECT,
        grupo: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  if (!cliente) {
    notFound();
  }

  // La ficha muestra los ítems de todas sus suscripciones: es lo que el cliente
  // tiene contratado, sin importar en qué suscripción esté agrupado.
  const asignaciones = cliente.suscripciones.flatMap((s) =>
    s.items.map((i) => ({
      id: i.id,
      suscripcionId: s.id,
      productoId: i.productoId,
      precio: Number(i.precio),
      ivaTasa: Number(i.ivaTasa),
      visitasPorPeriodo: i.visitasPorPeriodo,
      estado: s.estado,
      periodicidad: s.periodicidad,
      fechaInicio: s.fechaInicio.toISOString(),
      producto: {
        id: i.producto.id,
        nombre: i.producto.nombre,
        tipo: i.producto.tipo,
      },
    }))
  );

  const visitasSerialized = visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    notas: v.notas,
    cliente: v.cliente,
    productos: v.productos,
    grupo: v.grupo,
  }));

  // Las facturas no van en la ficha: son parte de la orden que las generó.
  const { items: ordenes } = await listarOrdenes(viewerFromUser(user), {
    clienteId: id,
    limit: 100,
  });

  return (
    <div>
      <ClienteDetailTabs
        cliente={{
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          empresa: cliente.empresa,
          email: cliente.email,
          telefono: cliente.telefono,
          ciudad: cliente.ciudad,
          sectorId: cliente.sectorId,
          sector: cliente.sector,
          direccion: cliente.direccion,
          numeroCasa: cliente.numeroCasa,
          referencia: cliente.referencia,
          notas: cliente.notas,
          metrosCuadrados: cliente.metrosCuadrados,
          recibirRecordatorios: cliente.recibirRecordatorios,
          recibirConfirmaciones: cliente.recibirConfirmaciones,
          createdAt: cliente.createdAt.toISOString(),
        }}
        asignaciones={asignaciones}
        ordenes={ordenes.map((o) => ({
          id: o.id,
          numero: o.numero,
          fecha: o.fecha.toISOString(),
          estado: o.estado,
          total: Number(o.total),
          lineas: o._count.lineas,
          facturas: o._count.facturas,
        }))}
        datosFacturacion={cliente.datosFacturacion.map((d) => ({
          id: d.id,
          tipoIdentificacion: d.tipoIdentificacion,
          identificacion: d.identificacion,
          razonSocial: d.razonSocial,
          tipoPersona: d.tipoPersona,
          direccion: d.direccion,
          telefono: d.telefono,
          email: d.email,
          esPredeterminado: d.esPredeterminado,
        }))}
        visitas={visitasSerialized}
        backHref={backHref}
      />
    </div>
  );
}

import { viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import { listarOrdenes } from "@/lib/services/orden.service";
import { OrdenesTable } from "@/components/ordenes/ordenes-table";
import { propiedadesDeVisitas } from "@vivero/shared";

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; q?: string; estado?: string }>;
}) {
  await requireStaff();
  const viewer = await viewerFromSession();
  const { cliente, q, estado } = await searchParams;
  /*
   * Los borradores tienen su propia página: acá va lo que ya se decidió
   * cobrar, y las anuladas quedan porque si no serían inalcanzables.
   *
   * **La búsqueda y el filtro de cobro los resuelve la base.** Se hacían en la
   * pantalla, sobre las cien órdenes que se traían: con trescientas en la
   * tabla, pedir "Sin cobrar" mostraba las sin cobrar *de esas cien* y la
   * lista se veía completa. Un filtro que miente sobre lo que no muestra es
   * peor que no tenerlo.
   */
  const { items } = await listarOrdenes(viewer, {
    limit: 100,
    clienteId: cliente,
    q,
    cobro: (estado || undefined) as
      | "SIN_COBRAR"
      | "PARCIAL"
      | "COBRADO"
      | "ANULADA"
      | undefined,
    estados: ["CONFIRMADA", "ANULADA"],
  });

  const serialized = items.map((o) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.fecha.toISOString(),
    estado: o.estado,
    cliente: o.cliente,
    // Dónde se trabajó, para poder distinguir dos órdenes del mismo cliente.
    // Sale de las visitas que cubre: una orden de un plan no tiene ninguna.
    propiedades: propiedadesDeVisitas(o.visitas.map((v) => v.visita)).map(
      (p) => p.nombre
    ),
    lineas: o._count.lineas,
    facturas: o._count.facturas,
    subtotal: Number(o.subtotal),
    iva: Number(o.iva),
    total: Number(o.total),
    saldo:
      o.facturas[0]?.saldo === undefined || o.facturas[0]?.saldo === null
        ? null
        : Number(o.facturas[0].saldo),
  }));

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <OrdenesTable ordenes={serialized} q={q ?? ""} estado={estado ?? ""} />
    </div>
  );
}

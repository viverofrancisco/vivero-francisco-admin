import { viewerFromSession } from "@/lib/auth-helpers";
import { listarOrdenes } from "@/lib/services/orden.service";
import { OrdenesTable } from "@/components/ordenes/ordenes-table";

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const viewer = await viewerFromSession();
  const { cliente } = await searchParams;
  // Los borradores tienen su propia página: acá va lo que ya se decidió cobrar.
  // Las anuladas quedan porque si no serían inalcanzables desde la interfaz.
  const { items } = await listarOrdenes(viewer, {
    limit: 100,
    clienteId: cliente,
    estados: ["CONFIRMADA", "ANULADA"],
  });

  const serialized = items.map((o) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.fecha.toISOString(),
    estado: o.estado,
    cliente: o.cliente,
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
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <OrdenesTable ordenes={serialized} />
    </div>
  );
}

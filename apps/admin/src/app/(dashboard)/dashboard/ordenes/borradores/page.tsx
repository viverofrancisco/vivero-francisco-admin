import { viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import { listarOrdenes } from "@/lib/services/orden.service";
import { BorradoresTable } from "@/components/ordenes/borradores-table";

export default async function BorradoresPage() {
  await requireStaff();
  const viewer = await viewerFromSession();
  const { items } = await listarOrdenes(viewer, {
    limit: 100,
    estados: ["BORRADOR"],
  });

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <BorradoresTable
        ordenes={items.map((o) => ({
          id: o.id,
          numero: o.numero,
          fecha: o.fecha.toISOString(),
          cliente: o.cliente,
          lineas: o._count.lineas,
          total: Number(o.total),
        }))}
      />
    </div>
  );
}

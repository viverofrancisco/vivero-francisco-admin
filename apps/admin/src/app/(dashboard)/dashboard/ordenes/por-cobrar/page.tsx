import { viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import { listarOrdenesPorCobrar } from "@/lib/services/orden.service";
import { PorCobrarPage } from "@/components/ordenes/por-cobrar-page";

export default async function PorCobrarRoute() {
  await requireStaff();
  const viewer = await viewerFromSession();
  const ordenes = await listarOrdenesPorCobrar(viewer);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PorCobrarPage
        ordenes={ordenes.map((o) => ({
          ...o,
          fecha: o.fecha.toISOString(),
          factura: {
            ...o.factura,
            fechaEmision: o.factura.fechaEmision.toISOString(),
          },
        }))}
      />
    </div>
  );
}

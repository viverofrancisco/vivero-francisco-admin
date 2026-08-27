import { viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import {
  borradoresSinConfirmar,
  listarOrdenesPorCobrar,
} from "@/lib/services/orden.service";
import { PorCobrarPage } from "@/components/ordenes/por-cobrar-page";

export default async function PorCobrarRoute() {
  await requireStaff();
  const viewer = await viewerFromSession();
  const [ordenes, borradores] = await Promise.all([
    listarOrdenesPorCobrar(viewer),
    borradoresSinConfirmar(viewer),
  ]);

  return (
    <div className="p-4 md:p-6">
      <PorCobrarPage
        ordenes={ordenes.map((o) => ({
          ...o,
          fecha: o.fecha.toISOString(),
          factura: {
            ...o.factura,
            fechaEmision: o.factura.fechaEmision.toISOString(),
          },
        }))}
        borradores={borradores}
      />
    </div>
  );
}

import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { listarEmisores } from "@/lib/services/emisor.service";
import { cifradoConfigurado } from "@/lib/sri/cifrado";
import { EmisoresPage } from "@/components/facturacion/emisores-page";

export default async function FacturacionElectronicaRoute() {
  await requireAdmin();
  const emisores = await listarEmisores(await viewerFromSession());

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <EmisoresPage
        // Sin la clave de cifrado no se puede guardar ningún certificado. Se
        // avisa en pantalla en vez de dejar que falle al subirlo.
        cifradoListo={cifradoConfigurado()}
        emisores={emisores.map((e) => ({
          ...e,
          certificadoVence: e.certificadoVence?.toISOString() ?? null,
          facturas: e._count.facturas,
        }))}
      />
    </div>
  );
}

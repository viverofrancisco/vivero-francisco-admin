import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { listarCentrosCosto } from "@/lib/services/centro-costo.service";
import { CentrosCosto } from "@/components/contabilidad/centros-costo";

export default async function CentrosCostoPage() {
  await requireStaff();
  const centros = await listarCentrosCosto(await viewerFromSession());
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <CentrosCosto centros={centros} />
    </div>
  );
}

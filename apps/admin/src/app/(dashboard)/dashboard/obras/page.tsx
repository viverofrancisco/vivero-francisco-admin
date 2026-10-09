import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { listarObras } from "@/lib/services/obra.service";
import { ObrasTable } from "@/components/obras/obras-table";

export default async function ObrasPage() {
  await requireStaff();
  // Todas: son decenas, y los filtros se resuelven en la pantalla.
  const obras = await listarObras(await viewerFromSession());
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <ObrasTable obras={obras} />
    </div>
  );
}

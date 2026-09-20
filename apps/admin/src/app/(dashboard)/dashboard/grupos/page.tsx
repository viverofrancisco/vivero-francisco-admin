import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { listGrupos } from "@/lib/services/grupo.service";
import { GruposTable } from "@/components/grupos/grupos-table";

/**
 * Las cuadrillas. La lista sale del servicio, la misma que lee la app, y el
 * encabezado lo pone `GruposTable`: su ⋯ prende el modo de selección.
 */
export default async function GruposPage() {
  await requireAuth();
  const grupos = await listGrupos(await viewerFromSession());

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <GruposTable grupos={grupos} />
    </div>
  );
}

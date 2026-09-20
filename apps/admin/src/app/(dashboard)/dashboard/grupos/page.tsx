import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { listGrupos } from "@/lib/services/grupo.service";
import { GruposTable } from "@/components/grupos/grupos-table";

/** Las cuadrillas. La lista sale del servicio, la misma que lee la app. */
export default async function GruposPage() {
  await requireAuth();
  const grupos = await listGrupos(await viewerFromSession());

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PageHeader
        title="Grupos"
        actions={[
          {
            label: "Nuevo Grupo",
            href: "/dashboard/grupos/nuevo",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <GruposTable grupos={grupos} />
    </div>
  );
}

import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { listarSolicitudes } from "@/lib/services/solicitud.service";
import { SolicitudesTable } from "@/components/solicitudes/solicitudes-table";

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string }>;
}) {
  const { abrir } = await searchParams;
  await requireStaff();
  const viewer = await viewerFromSession();
  // Todas de una: son pocas, y el filtro de estado se resuelve en la pantalla.
  const { items } = await listarSolicitudes(viewer, { estado: "todas", limit: 100 });

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      {/* La `key` la vuelve a montar cuando la búsqueda global trae otra
          solicitud para abrir: sus filtros se leen de la URL al montar. */}
      <SolicitudesTable key={abrir ?? ""} solicitudes={items} />
    </div>
  );
}

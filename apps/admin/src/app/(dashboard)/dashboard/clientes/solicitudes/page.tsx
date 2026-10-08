import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { listarSolicitudes } from "@/lib/services/solicitud.service";
import { SolicitudesTable } from "@/components/solicitudes/solicitudes-table";

export default async function SolicitudesPage() {
  await requireStaff();
  const viewer = await viewerFromSession();
  // Todas de una: son pocas, y el filtro de estado se resuelve en la pantalla.
  const { items } = await listarSolicitudes(viewer, { estado: "todas", limit: 100 });

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <SolicitudesTable solicitudes={items} />
    </div>
  );
}

import { requireStaff, viewerFromUser } from "@/lib/auth-helpers";
import { getOrdenTareas, listTareas } from "@/lib/services/tarea.service";
import { TareasPageClient } from "@/components/tareas/tareas-page-client";

export default async function TareasPage() {
  // `requireStaff` redirige en vez de romper: un jardinero que llega acá por la
  // URL vuelve al panel, no ve un 500.
  const user = await requireStaff();
  const [tareas, modoOrden] = await Promise.all([
    listTareas(viewerFromUser(user)),
    getOrdenTareas(),
  ]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <TareasPageClient tareas={tareas} modoOrden={modoOrden} />
    </div>
  );
}

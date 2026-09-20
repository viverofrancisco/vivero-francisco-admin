import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { listPersonal } from "@/lib/services/personal.service";
import { PersonalTable } from "@/components/personal/personal-table";

/**
 * La lista sale del servicio, no de una consulta propia.
 *
 * Tenía la suya —con su `include` y su cálculo del estado de acceso— mientras
 * la app pedía lo mismo por `/api/mobile/personal`, así que las dos listas
 * mostraban campos distintos de la misma gente. Ahora las dos leen
 * `listPersonal`.
 *
 * El encabezado lo pone `PersonalTable`: su ⋯ prende el modo de selección, que
 * es estado de esa pantalla.
 */
export default async function PersonalPage() {
  await requireAuth();
  const personal = await listPersonal(await viewerFromSession());

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <PersonalTable personal={personal} />
    </div>
  );
}

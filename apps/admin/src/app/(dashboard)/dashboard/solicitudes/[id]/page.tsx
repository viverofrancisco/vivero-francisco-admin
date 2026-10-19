import { notFound } from "next/navigation";
import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { obtenerSolicitud } from "@/lib/services/solicitud.service";
import { NotFoundError } from "@/lib/services/errors";
import { FichaSolicitud } from "@/components/solicitudes/ficha-solicitud";

/**
 * Una solicitud, en su página: la pantalla de la app del equipo
 * (`solicitudes/[id]`). En el teléfono la lista abre esta; en el escritorio
 * la lista la sigue mostrando en su diálogo, y esta página sirve igual.
 */
export default async function SolicitudPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireStaff();
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const solicitud = await obtenerSolicitud(await viewerFromSession(), id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <FichaSolicitud
      solicitud={solicitud}
      volverA={hrefDeVuelta(from, "/dashboard/solicitudes")}
    />
  );
}

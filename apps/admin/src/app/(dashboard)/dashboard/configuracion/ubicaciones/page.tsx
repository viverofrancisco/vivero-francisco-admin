import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { listUbicaciones } from "@/lib/services/ubicacion.service";
import { UbicacionesLista } from "@/components/configuracion/ubicaciones-lista";

export default async function UbicacionesPage() {
  await requireAdmin();
  const ubicaciones = await listUbicaciones(await viewerFromSession());
  return <UbicacionesLista ubicaciones={ubicaciones} />;
}

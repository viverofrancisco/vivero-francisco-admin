import { requireAuth } from "@/lib/auth-helpers";
import { listDefaultFirmantes } from "@/lib/services/firmante.service";
import { InformeWizard } from "@/components/informes/informe-wizard";

export default async function NuevoInformePage() {
  await requireAuth();
  const defaults = await listDefaultFirmantes();
  const defaultFirmantes = defaults.map((f) => ({
    nombre: f.nombre,
    cedula: f.cedula,
  }));
  return <InformeWizard defaultFirmantes={defaultFirmantes} />;
}

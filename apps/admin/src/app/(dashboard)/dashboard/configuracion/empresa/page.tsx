import { requireAdmin } from "@/lib/auth-helpers";
import { getEmpresaConfig } from "@/lib/services/empresa-config.service";
import { EmpresaConfigForm } from "@/components/empresa/empresa-config-form";

export default async function EmpresaConfigPage() {
  await requireAdmin();
  const cfg = await getEmpresaConfig();
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza el nombre y el logo que se muestran en el sistema y en
          los informes generados.
        </p>
      </div>
      <EmpresaConfigForm
        initial={{
          nombre: cfg.nombre,
          logoUrl: cfg.logoUrl,
          logoKey: cfg.logoKey,
        }}
      />
    </div>
  );
}

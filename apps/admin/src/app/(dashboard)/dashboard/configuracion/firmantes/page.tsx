import { requireRole } from "@/lib/auth-helpers";
import { listFirmantes } from "@/lib/services/firmante.service";
import { FirmantesClient } from "@/components/configuracion/firmantes-client";

export default async function FirmantesPage() {
  await requireRole("ADMIN");
  const items = await listFirmantes();
  const serialized = items.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    cedula: f.cedula,
    isDefault: f.isDefault,
    orden: f.orden,
  }));
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Firmantes</h1>
        <p className="text-sm text-muted-foreground">
          Personas que pueden firmar los informes. Marca uno o más como
          predeterminados para que aparezcan automáticamente al generar un
          informe nuevo.
        </p>
      </div>
      <FirmantesClient initialItems={serialized} />
    </div>
  );
}

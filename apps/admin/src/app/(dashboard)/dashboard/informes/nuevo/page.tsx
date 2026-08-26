import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { listDefaultFirmantes } from "@/lib/services/firmante.service";
import { InformeWizard } from "@/components/informes/informe-wizard";

export default async function NuevoInformePage() {
  await requireAuth();
  const defaults = await listDefaultFirmantes();
  // Todo el catálogo activo: una sección puede ser de algo que no se hizo en
  // estas visitas —material entregado, un extra— y hasta ahora solo se podía
  // elegir entre los productos de las visitas o escribir el título a mano.
  const catalogo = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
  const defaultFirmantes = defaults.map((f) => ({
    nombre: f.nombre,
    cedula: f.cedula,
  }));
  return <InformeWizard defaultFirmantes={defaultFirmantes} catalogo={catalogo} />;
}

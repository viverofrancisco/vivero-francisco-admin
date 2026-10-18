import { requireAdmin } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { UbicacionForm } from "@/components/configuracion/ubicacion-form";

export default async function NuevaUbicacionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const { from } = await searchParams;
  return (
    <UbicacionForm
      ubicacion={null}
      volverA={hrefDeVuelta(from, "/dashboard/configuracion/ubicaciones")}
    />
  );
}

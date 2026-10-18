import { notFound } from "next/navigation";
import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { getUbicacion } from "@/lib/services/ubicacion.service";
import { NotFoundError } from "@/lib/services/errors";
import { UbicacionForm } from "@/components/configuracion/ubicacion-form";

export default async function UbicacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const ubicacion = await getUbicacion(await viewerFromSession(), id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <UbicacionForm
      key={ubicacion.id}
      ubicacion={ubicacion}
      volverA={hrefDeVuelta(from, "/dashboard/configuracion/ubicaciones")}
    />
  );
}

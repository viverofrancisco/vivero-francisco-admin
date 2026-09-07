import { notFound } from "next/navigation";
import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { NotFoundError } from "@/lib/services/errors";
import { getCategoria } from "@/lib/services/categoria.service";
import { CategoriaDetail } from "@/components/servicios/categoria-detail";

/**
 * La ficha de una categoría.
 *
 * Agrupar el catálogo se hace desde acá: poner doce plantas en "Interior"
 * abriendo doce fichas es el camino largo del mismo trabajo.
 */
export default async function CategoriaRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const viewer = await viewerFromSession();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/productos/categorias");

  try {
    const categoria = await getCategoria(viewer, id);
    return (
      <div className="p-4 md:p-6">
        <CategoriaDetail categoria={categoria} backHref={backHref} />
      </div>
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

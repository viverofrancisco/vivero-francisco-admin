import { notFound } from "next/navigation";
import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { NotFoundError } from "@/lib/services/errors";
import { getCategoria } from "@/lib/services/categoria.service";
import { CategoriaForm } from "@/components/servicios/categoria-form";

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

  // El `try` envuelve **solo la consulta**: el JSX se construye afuera. React
  // no renderiza en el momento en que se lo escribe, así que un error del
  // componente no caería en este `catch` — y el `notFound()` de adentro sí
  // sería atrapado por él, que es peor.
  let categoria;
  try {
    categoria = await getCategoria(viewer, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="p-4 md:p-6">
      <CategoriaForm categoria={categoria} backHref={backHref} />
    </div>
  );
}

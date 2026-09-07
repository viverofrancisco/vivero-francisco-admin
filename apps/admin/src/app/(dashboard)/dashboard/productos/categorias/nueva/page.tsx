import { requireAdmin } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { CategoriaForm } from "@/components/servicios/categoria-form";

/**
 * Una categoría nueva.
 *
 * Es el mismo formulario que la ficha porque es el mismo trabajo: al crear una
 * categoría ya se sabe qué productos van adentro, y obligar a guardarla vacía
 * para después volver a abrirla partía en dos algo que se piensa junto.
 */
export default async function NuevaCategoriaRoute({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/productos/categorias");

  return (
    <div className="p-4 md:p-6">
      <CategoriaForm categoria={null} backHref={backHref} />
    </div>
  );
}

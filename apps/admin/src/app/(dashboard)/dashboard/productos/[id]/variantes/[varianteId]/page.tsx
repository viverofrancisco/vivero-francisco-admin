import { notFound, redirect } from "next/navigation";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { NotFoundError } from "@/lib/services/errors";
import { getVariante } from "@/lib/services/variante.service";
import { movimientosDeVariante } from "@/lib/services/inventario.service";
import { listarImagenes } from "@/lib/services/producto-imagen.service";
import { VarianteDetail } from "@/components/servicios/variante-detail";

/**
 * La ficha de una variante.
 *
 * Una variante es la unidad real de lo que se vende —su precio, su SKU, su
 * stock— y cargarlos de a seis en una tabla es incómodo. Acá cada una tiene su
 * lugar, con sus hermanas al costado para saltar entre ellas.
 */
export default async function VarianteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; varianteId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const { id, varianteId } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, `/dashboard/productos/${id}`);

  let variante;
  try {
    variante = await getVariante(viewer, varianteId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // La variante manda sobre la URL: entrar con el producto equivocado —un
  // enlace viejo, un id tipeado— lleva al producto correcto en vez de mostrar
  // una ficha que dice pertenecer a otro.
  if (variante.producto.id !== id) {
    redirect(
      `/dashboard/productos/${variante.producto.id}/variantes/${varianteId}`
    );
  }

  const [imagenes, movimientos] = await Promise.all([
    listarImagenes(viewer, variante.producto.id),
    movimientosDeVariante(viewer, varianteId),
  ]);

  return (
    <div className="p-4 md:p-6">
      <VarianteDetail
        variante={variante}
        imagenes={imagenes}
        movimientos={movimientos.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
        backHref={backHref}
      />
    </div>
  );
}

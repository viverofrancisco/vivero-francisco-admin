import { requireAdmin, viewerFromSession } from "@/lib/auth-helpers";
import { listarCategorias } from "@/lib/services/categoria.service";
import { CategoriasPage } from "@/components/servicios/categorias-page";

export default async function CategoriasRoute() {
  await requireAdmin();
  const categorias = await listarCategorias(await viewerFromSession());

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <CategoriasPage
        categorias={categorias.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          orden: c.orden,
          contificoCategoriaId: c.contificoCategoriaId,
          contificoCategoriaNombre: c.contificoCategoriaNombre,
          productos: c._count.productos,
        }))}
      />
    </div>
  );
}

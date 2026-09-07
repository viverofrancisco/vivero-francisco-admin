import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { getCatalogoDelProducto } from "@/lib/services/variante.service";
import { listarImagenes } from "@/lib/services/producto-imagen.service";
import { ServicioDetail } from "@/components/servicios/servicio-detail";

export default async function EditarServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/productos");

  const servicio = await prisma.producto.findUnique({
    where: { id },
    include: { categorias: { select: { categoriaId: true } } },
  });

  if (!servicio) {
    notFound();
  }

  const viewer = await viewerFromSession();
  // Las fotos son de todo producto; los ejes y las variantes, solo de un bien.
  const [imagenes, catalogo] = await Promise.all([
    listarImagenes(viewer, id),
    servicio.tipo === "BIEN" ? getCatalogoDelProducto(viewer, id) : null,
  ]);

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  return (
    <div className="p-4 md:p-6">
      <ServicioDetail
        backHref={backHref}
        servicio={{
          ...servicio,
          // Decimal no cruza a un componente cliente.
          ivaTasa: servicio.ivaTasa === null ? null : Number(servicio.ivaTasa),
          // La ficha de un archivado se abre igual, pero tiene que decirlo.
          archivadoEl: servicio.deletedAt?.toISOString() ?? null,
          categoriaIds: servicio.categorias.map((c) => c.categoriaId),
        }}
        categorias={categorias}
        imagenes={imagenes}
        opciones={
          catalogo?.opciones.map((o) => ({
            id: o.id,
            nombre: o.nombre,
            valores: o.valores.map((v) => ({ id: v.id, valor: v.valor })),
          })) ?? []
        }
        variantes={
          catalogo?.variantes.map((v) => ({
            id: v.id,
            sku: v.sku,
            precio: v.precio,
            cobraIva: v.cobraIva,
            manejaInventario: v.manejaInventario,
            stock: v.stock,
            permiteNegativo: v.permiteNegativo,
            imagenId: v.imagenId,
            valores: v.valores.map((x) => ({ opcion: x.opcion, valor: x.valor })),
          })) ?? []
        }
      />
    </div>
  );
}

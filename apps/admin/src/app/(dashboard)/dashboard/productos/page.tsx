import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { PageHeader } from "@/components/shared/page-header";
import { textoPlano } from "@/lib/html-seguro";

export default async function ServiciosPage() {
  await requireAuth();

  // `select` y no la fila entera: `ivaTasa` es un `Decimal` de Prisma, que no
  // se puede serializar hacia un componente cliente —Next lo avisa por consola
  // en cada carga— y la tabla no lo usa. Igual que `_count`, que tampoco.
  // Los archivados vienen también: el filtro de la tabla decide cuáles se ven,
  // y sin traerlos no había forma de mirarlos desde el portal. El catálogo es
  // chico, así que traerlo entero cuesta menos que una consulta por filtro.
  const servicios = await prisma.producto.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      descripcion: true,

      deletedAt: true,
      categorias: {
        select: { categoria: { select: { id: true, nombre: true } } },
      },
      // Para la columna de stock: un bien puede tener varias variantes y lo
      // que se muestra es el total de las que se cuentan.
      // El código sale del SKU de la variante: es donde vive. Con una sola
      // —servicios y bienes sin opciones— es "el" código del producto; con
      // varias, cada una tiene el suyo y la lista no muestra ninguno.
      variantes: {
        orderBy: { posicion: "asc" },
        select: { manejaInventario: true, stock: true, sku: true },
      },
    },
  });

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Productos"
        description="Servicios y bienes que se le pueden vender a un cliente"
        actions={[
          {
            label: "Nuevo producto",
            href: "/dashboard/productos/nuevo",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <ServiciosTable
        productos={servicios.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          // Sin etiquetas: la tabla la muestra en una línea y busca por ella.
          descripcion: textoPlano(p.descripcion),
          codigo: p.variantes.length === 1 ? p.variantes[0].sku : null,
          // Texto y no `Date`: la tabla solo lo muestra.
          archivadoEl: p.deletedAt?.toISOString() ?? null,
          categorias: p.categorias.map((c) => c.categoria),
          // `null` = no cuenta stock, que no es lo mismo que tener cero.
          stock: p.variantes.some((v) => v.manejaInventario)
            ? p.variantes
                .filter((v) => v.manejaInventario)
                .reduce((n, v) => n + v.stock, 0)
            : null,
          variantes: p.variantes.length,
        }))}
        categorias={categorias}
      />
    </div>
  );
}

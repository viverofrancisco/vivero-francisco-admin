import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { ProductosHeader } from "@/components/servicios/boton-nuevo-producto";
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
      estado: true,
      deletedAt: true,
      categorias: {
        select: { categoria: { select: { id: true, nombre: true } } },
      },
      // Para la columna de stock: un bien puede tener varias variantes y lo
      // que se muestra es el total de las que se cuentan.
      variantes: {
        orderBy: { posicion: "asc" },
        select: { manejaInventario: true, stock: true },
      },
    },
  });

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      {/* El encabezado es cliente: "Nuevo producto" abre el diálogo que
          pregunta el tipo antes de llevar a la ficha. */}
      <ProductosHeader />

      <ServiciosTable
        productos={servicios.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          // Sin etiquetas: la tabla la muestra en una línea y busca por ella.
          descripcion: textoPlano(p.descripcion),
          estado: p.estado,
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

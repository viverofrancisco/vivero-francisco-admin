import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { PageHeader } from "@/components/shared/page-header";

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
      contificoProductoId: true,
      deletedAt: true,
      categoria: { select: { id: true, nombre: true } },
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
          descripcion: p.descripcion,
          contificoProductoId: p.contificoProductoId,
          // Texto y no `Date`: la tabla solo lo muestra.
          archivadoEl: p.deletedAt?.toISOString() ?? null,
          categoriaId: p.categoria?.id ?? null,
          categoriaNombre: p.categoria?.nombre ?? null,
        }))}
        categorias={categorias}
      />
    </div>
  );
}

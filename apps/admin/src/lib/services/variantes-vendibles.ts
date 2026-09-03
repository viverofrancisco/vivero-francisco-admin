/**
 * Las variantes que se pueden vender, listas para el selector de una orden.
 *
 * Una sola consulta para el catálogo entero en vez de una por producto: el
 * catálogo es chico y el editor de líneas los necesita todos igual, para poder
 * cambiar de producto sin ir al servidor.
 */
import { prisma } from "@/lib/prisma";

export interface ProductoConVariantes {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  variantes: {
    id: string;
    nombre: string;
    sku: string | null;
    manejaInventario: boolean;
    stock: number;
  }[];
}

export async function productosVendibles(): Promise<ProductoConVariantes[]> {
  const productos = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      ivaTasa: true,
      variantes: {
        orderBy: { posicion: "asc" },
        select: {
          id: true,
          sku: true,
          manejaInventario: true,
          stock: true,
          valores: {
            select: {
              valor: {
                select: {
                  valor: true,
                  opcion: { select: { posicion: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    ivaTasa: p.ivaTasa === null ? null : Number(p.ivaTasa),
    variantes: p.variantes.map((v) => ({
      id: v.id,
      // Los valores en el orden de sus ejes: "Rojo · Grande", no al revés.
      nombre:
        v.valores
          .map((x) => x.valor)
          .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
          .map((x) => x.valor)
          .join(" · ") || p.nombre,
      sku: v.sku,
      manejaInventario: v.manejaInventario,
      stock: v.stock,
    })),
  }));
}

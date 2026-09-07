/**
 * Las variantes que se pueden vender, listas para el selector de una orden.
 *
 * Se piden **de a tandas**. Antes venía el catálogo entero de una, con sus
 * variantes: con veinte productos no se nota, pero cada uno arrastra sus
 * combinaciones y eso crece rápido — y se pagaba enteroderecho al abrir la
 * pantalla, aunque la orden terminara con dos líneas.
 *
 * La pantalla se queda con todo lo que fue viendo, así que cambiar de producto
 * en una línea ya cargada sigue sin ir al servidor.
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
    /** Precio de lista: lo que se propone al agregarla a una orden. */
    precio: number;
    /** Si se le cobra IVA. La tasa sale del producto. */
    cobraIva: boolean;
    manejaInventario: boolean;
    stock: number;
  }[];
}

export async function productosVendibles(
  opciones: { search?: string; offset?: number; limit?: number; ids?: string[] } = {}
): Promise<{ items: ProductoConVariantes[]; hayMas: boolean }> {
  const limit = Math.min(Math.max(opciones.limit ?? 20, 1), 100);
  const offset = Math.max(0, opciones.offset ?? 0);
  const search = opciones.search?.trim();
  const productos = await prisma.producto.findMany({
    where: {
      // Un borrador no se ofrece: es lo que evita que algo a medio configurar
      // —sin precio, sin SKU— termine en una factura por estar en la lista.
      deletedAt: null,
      estado: "ACTIVO",
      ...(search ? { nombre: { contains: search, mode: "insensitive" } } : {}),
      // Pedidos por id: los que una orden ya usa. Tienen que venir aunque no
      // entren en la primera tanda, o la línea se quedaría sin su producto.
      ...(opciones.ids?.length ? { id: { in: opciones.ids } } : {}),
    },
    orderBy: { nombre: "asc" },
    ...(opciones.ids?.length ? {} : { skip: offset, take: limit + 1 }),
    select: {
      id: true,
      nombre: true,
      ivaTasa: true,
      variantes: {
        orderBy: { posicion: "asc" },
        select: {
          id: true,
          sku: true,
          precio: true,
          cobraIva: true,
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

  const hayMas = !opciones.ids?.length && productos.length > limit;
  const enTanda = hayMas ? productos.slice(0, limit) : productos;

  const items = enTanda.map((p) => ({
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
      precio: Number(v.precio),
      cobraIva: v.cobraIva,
      manejaInventario: v.manejaInventario,
      stock: v.stock,
    })),
  }));

  return { items, hayMas };
}

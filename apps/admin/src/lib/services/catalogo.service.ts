import { prisma } from "@/lib/prisma";
import { publicUrlForKey } from "@/lib/s3";
import { textoPlano } from "@/lib/html-seguro";
import type {
  ProductoDelCatalogo,
  ProductoDelCatalogoDetalle,
} from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "./errors";

/**
 * El catálogo como lo ve un cliente: lo que se vende, con su foto y su precio.
 *
 * Aparte del de `servicio.service` a propósito: aquel es la herramienta de la
 * oficina —borradores, SKU, costo, stock, archivados— y este es la vidriera.
 * Lo que sale de acá es solo lo que se puede mostrar: productos `ACTIVO` y
 * vivos, el precio **con IVA** —el que paga quien compra— y nada del costo ni
 * del inventario.
 *
 * Un servicio no lleva precio: una poda se cotiza cada vez. Un bien con precio
 * cero tampoco, porque cero en la lista casi siempre quiere decir que nadie le
 * puso precio, y mostrarle "Gratis" a un cliente es prometer algo.
 */

const SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  tipo: true,
  ivaTasa: true,
  imagenes: {
    orderBy: { posicion: "asc" },
    select: { id: true, media: { select: { key: true } } },
  },
  categorias: {
    orderBy: { posicion: "asc" },
    select: { categoria: { select: { nombre: true } } },
  },
  variantes: {
    orderBy: { posicion: "asc" },
    select: {
      id: true,
      precio: true,
      cobraIva: true,
      imagenId: true,
      valores: {
        select: {
          valor: { select: { valor: true, opcion: { select: { posicion: true } } } },
        },
      },
    },
  },
} satisfies Prisma.ProductoSelect;

type Fila = Prisma.ProductoGetPayload<{ select: typeof SELECT }>;

function conIva(precio: number, cobraIva: boolean, tasa: number | null): number {
  const t = cobraIva ? tasa ?? 0 : 0;
  return Math.round(precio * (1 + t / 100) * 100) / 100;
}

function preciosDe(p: Fila): (number | null)[] {
  if (p.tipo === "SERVICIO") return p.variantes.map(() => null);
  const tasa = p.ivaTasa === null ? null : Number(p.ivaTasa);
  return p.variantes.map((v) => {
    const precio = Number(v.precio);
    return precio > 0 ? conIva(precio, v.cobraIva, tasa) : null;
  });
}

function aFila(p: Fila): ProductoDelCatalogo {
  const precios = preciosDe(p).filter((x): x is number => x !== null);
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    resumen: textoPlano(p.descripcion),
    imagenUrl: p.imagenes[0] ? publicUrlForKey(p.imagenes[0].media.key) : null,
    precioDesde: precios.length ? Math.min(...precios) : null,
    precioHasta: precios.length ? Math.max(...precios) : null,
    categorias: p.categorias.map((c) => c.categoria.nombre),
  };
}

/** El HTML de la descripción como texto, conservando los párrafos. */
function textoConParrafos(html: string | null): string | null {
  if (!html) return null;
  const texto = html
    .replace(/<\/(p|h2|h3|ul|ol)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return texto || null;
}

const VISIBLE = { deletedAt: null, estado: "ACTIVO" } as const;

export async function listarCatalogo(
  opciones: { search?: string; offset?: number; limit?: number } = {}
): Promise<{ items: ProductoDelCatalogo[]; hayMas: boolean }> {
  const limit = Math.min(Math.max(opciones.limit ?? 40, 1), 100);
  const offset = Math.max(0, opciones.offset ?? 0);
  const q = opciones.search?.trim();
  const filas = await prisma.producto.findMany({
    where: {
      ...VISIBLE,
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { descripcion: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nombre: "asc" },
    skip: offset,
    take: limit + 1,
    select: SELECT,
  });
  const hayMas = filas.length > limit;
  return { items: filas.slice(0, limit).map(aFila), hayMas };
}

export async function productoDelCatalogo(
  id: string
): Promise<ProductoDelCatalogoDetalle> {
  const p = await prisma.producto.findFirst({ where: { id, ...VISIBLE }, select: SELECT });
  if (!p) throw new NotFoundError("Este producto ya no está disponible");

  const precios = preciosDe(p);
  const urlDeImagen = new Map(p.imagenes.map((i) => [i.id, publicUrlForKey(i.media.key)]));
  return {
    ...aFila(p),
    descripcion: textoConParrafos(p.descripcion),
    imagenes: p.imagenes.map((i) => publicUrlForKey(i.media.key)),
    variantes: p.variantes.map((v, i) => ({
      id: v.id,
      nombre: v.valores
        .map((x) => x.valor)
        .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
        .map((x) => x.valor)
        .join(" / "),
      precio: precios[i],
      imagenUrl: v.imagenId ? urlDeImagen.get(v.imagenId) ?? null : null,
    })),
  };
}

import { prisma } from "@/lib/prisma";
import { publicUrlForKey } from "@/lib/s3";
import { textoPlano } from "@/lib/html-seguro";
import type {
  ProductoDelCatalogo,
  ProductoDelCatalogoDetalle,
  VarianteDelCatalogo,
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
 * Solo bienes (ver `VISIBLE`). Un bien siempre tiene precio —es obligatorio
 * en la variante—, y **cero es gratis**: la app lo dice *Gratis*, como el
 * portal.
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
    select: { categoriaId: true, categoria: { select: { nombre: true } } },
  },
  variantes: {
    orderBy: { posicion: "asc" },
    select: {
      id: true,
      precio: true,
      cobraIva: true,
      imagenId: true,
      stock: true,
      manejaInventario: true,
      permiteNegativo: true,
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
    return conIva(precio, v.cobraIva, tasa);
  });
}

/**
 * Cuántas se pueden pedir de una variante: `null` es sin límite —un servicio,
 * una variante que no lleva inventario o que se vende sin stock—, y un número
 * es lo que queda en el estante (0 es *Agotado*). Es la misma regla que aplica
 * la reserva del pedido (`reserva.service.ts`), así la app no ofrece lo que
 * el servidor va a rechazar.
 */
function disponibleDe(p: Fila, v: Fila["variantes"][number]): number | null {
  if (p.tipo === "SERVICIO" || !v.manejaInventario || v.permiteNegativo) return null;
  return Math.max(0, v.stock);
}

function variantesDe(p: Fila): VarianteDelCatalogo[] {
  const precios = preciosDe(p);
  const urlDeImagen = new Map(p.imagenes.map((i) => [i.id, publicUrlForKey(i.media.key)]));
  return p.variantes.map((v, i) => {
    const valores = v.valores
      .map((x) => x.valor)
      .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
      .map((x) => x.valor);
    return {
      id: v.id,
      nombre: valores.join(" / "),
      valores,
      precio: precios[i],
      imagenUrl: v.imagenId ? urlDeImagen.get(v.imagenId) ?? null : null,
      disponible: disponibleDe(p, v),
    };
  });
}

function aFila(p: Fila): ProductoDelCatalogo {
  const precios = preciosDe(p).filter((x): x is number => x !== null);
  const disponibles = p.variantes.map((v) => disponibleDe(p, v));
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    resumen: textoPlano(p.descripcion),
    imagenUrl: p.imagenes[0] ? publicUrlForKey(p.imagenes[0].media.key) : null,
    precioDesde: precios.length ? Math.min(...precios) : null,
    precioHasta: precios.length ? Math.max(...precios) : null,
    categorias: p.categorias.map((c) => c.categoria.nombre),
    // Agotado solo si no queda ninguna: con una variante disponible, la ficha
    // deja elegirla.
    agotado: disponibles.length > 0 && disponibles.every((d) => d === 0),
    // Con una sola variante la tarjeta la añade sin abrir la ficha.
    varianteUnicaId: p.variantes.length === 1 ? p.variantes[0].id : null,
    disponibleUnica: p.variantes.length === 1 ? disponibles[0] : null,
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

/**
 * Lo que está en la vidriera: activo, vivo y **solo bienes**. Los servicios
 * salieron del catálogo de la app —una poda no se mete al carrito: se cotiza
 * cada vez—, y se piden marcándolos en la solicitud de visita
 * (`serviciosParaSolicitar`). La ficha de uno da 404, como la de un archivado.
 */
const VISIBLE = { deletedAt: null, estado: "ACTIVO", tipo: "BIEN" } as const;

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

/**
 * La ficha de un producto. `ligero` es para el drawer de *Elegir opciones*:
 * sin las recomendaciones, que el drawer no muestra y eran la mitad de las
 * consultas —contra Neon desde fuera, cada una es una vuelta que se nota—.
 * Las opciones vienen en la misma consulta que el producto, y las dos
 * recomendaciones se piden a la vez.
 */
export async function productoDelCatalogo(
  id: string,
  { ligero = false }: { ligero?: boolean } = {}
): Promise<ProductoDelCatalogoDetalle> {
  const p = await prisma.producto.findFirst({
    where: { id, ...VISIBLE },
    select: {
      ...SELECT,
      opciones: {
        orderBy: { posicion: "asc" },
        select: { nombre: true, valores: { orderBy: { posicion: "asc" }, select: { valor: true } } },
      },
    },
  });
  if (!p) throw new NotFoundError("Este producto ya no está disponible");
  const { opciones } = p;

  const [compradosJuntos, parecidos] = ligero
    ? [[], []]
    : await Promise.all([pedidosJuntoA(p.id), parecidosA(p, [p.id], RECOMENDADOS * 2)]);
  // Lo que ya está en *Se pide junto con* no se repite en *También te puede gustar*.
  const juntos = new Set(compradosJuntos.map((x) => x.id));
  const teGustaria = parecidos.filter((x) => !juntos.has(x.id)).slice(0, RECOMENDADOS);
  return {
    ...aFila(p),
    descripcion: textoConParrafos(p.descripcion),
    imagenes: p.imagenes.map((i) => publicUrlForKey(i.media.key)),
    opciones: opciones.map((o) => ({ nombre: o.nombre, valores: o.valores.map((v) => v.valor) })),
    variantes: variantesDe(p),
    compradosJuntos,
    teGustaria,
  };
}

const RECOMENDADOS = 8;

/**
 * *Se pide junto con*: los productos que más veces aparecen en los mismos
 * pedidos que este —las órdenes no anuladas, del portal y de la app—, como el
 * *Frequently bought together* de Amazon. Sale de lo que de verdad se vendió,
 * no de una lista que alguien tenga que mantener.
 */
async function pedidosJuntoA(productoId: string): Promise<ProductoDelCatalogo[]> {
  const conteo = await prisma.ordenLinea.groupBy({
    by: ["productoId"],
    where: {
      productoId: { not: null, notIn: [productoId] },
      orden: { estado: { not: "ANULADA" }, lineas: { some: { productoId } } },
    },
    _count: { ordenId: true },
    orderBy: { _count: { ordenId: "desc" } },
    take: RECOMENDADOS * 2,
  });
  const ids = conteo.map((c) => c.productoId).filter((x): x is string => x !== null);
  if (ids.length === 0) return [];
  const filas = await prisma.producto.findMany({
    where: { id: { in: ids }, ...VISIBLE },
    select: SELECT,
  });
  const porId = new Map(filas.map((f) => [f.id, f]));
  return ids
    .map((id) => porId.get(id))
    .filter((f): f is Fila => f !== undefined)
    .slice(0, RECOMENDADOS)
    .map(aFila);
}

/**
 * *También te puede gustar*: de sus mismas categorías primero y, si no
 * alcanza, lo último que se actualizó del catálogo.
 */
async function parecidosA(
  p: Fila,
  fuera: string[],
  cuantos = RECOMENDADOS
): Promise<ProductoDelCatalogo[]> {
  const categoriaIds = p.categorias.map((c) => c.categoriaId);
  const deSusCategorias = categoriaIds.length
    ? await prisma.producto.findMany({
        where: {
          ...VISIBLE,
          id: { notIn: fuera },
          categorias: { some: { categoriaId: { in: categoriaIds } } },
        },
        orderBy: { nombre: "asc" },
        take: cuantos,
        select: SELECT,
      })
    : [];
  const faltan = cuantos - deSusCategorias.length;
  const delMismoTipo =
    faltan > 0
      ? await prisma.producto.findMany({
          where: {
            ...VISIBLE,
            id: { notIn: [...fuera, ...deSusCategorias.map((x) => x.id)] },
          },
          orderBy: { updatedAt: "desc" },
          take: faltan,
          select: SELECT,
        })
      : [];
  return [...deSusCategorias, ...delMismoTipo].map(aFila);
}

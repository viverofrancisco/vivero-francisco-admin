/**
 * Categorías del catálogo.
 *
 * Es lo que sirve para encontrar un producto en una lista, nada más: no sale
 * impresa en la factura ni cambia cómo se emite.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { ForbiddenError } from "./errors";
import { sanitizarHtml } from "@/lib/html-seguro";
import { publicUrlForKey } from "@/lib/s3";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface CategoriaInput {
  nombre: string;
  orden?: number;
  /** De qué se trata. HTML de un editor: se sanea acá. */
  descripcion?: string | null;
  /** La foto que la representa. Sale de la biblioteca. */
  mediaId?: string | null;
}

/** Todas, con cuántos productos vivos tiene cada una. */
export async function listarCategorias(viewer: Viewer) {
  ensureAdmin(viewer);
  return prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: {
      // A través de la puente, y contando solo los productos vivos: un
      // archivado sigue teniendo su fila y sumaría de más.
      _count: {
        select: { productos: { where: { producto: { deletedAt: null } } } },
      },
    },
  });
}

function limpiar(payload: CategoriaInput) {
  const nombre = payload.nombre.trim();
  if (!nombre) throw new ValidationError("La categoría necesita un nombre.");
  return {
    nombre,
    orden: payload.orden ?? 0,
    ...(payload.descripcion !== undefined
      ? { descripcion: sanitizarHtml(payload.descripcion) }
      : {}),
    ...(payload.mediaId !== undefined ? { mediaId: payload.mediaId } : {}),
  };
}

/**
 * El nombre repetido se atrapa por el índice único y no por una consulta
 * previa: entre el `findFirst` y el `create` hay lugar para que otra pestaña
 * gane la carrera, y la base es la única que no se equivoca.
 */
function comoConflicto(error: unknown, nombre: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictError(`Ya hay una categoría llamada "${nombre}".`);
  }
  throw error;
}

export async function crearCategoria(viewer: Viewer, payload: CategoriaInput) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.categoria.create({ data: datos });
  } catch (error) {
    comoConflicto(error, datos.nombre);
  }
}

export async function actualizarCategoria(
  viewer: Viewer,
  id: string,
  payload: CategoriaInput
) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.categoria.update({ where: { id }, data: datos });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Categoría no encontrada");
    }
    comoConflicto(error, datos.nombre);
  }
}

/**
 * La borra de verdad.
 *
 * No hay borrado suave: una categoría es una etiqueta para agrupar, no un hecho
 * que haya que conservar, y una archivada que sigue colgando de sus productos
 * sería una categoría que se ve en las fichas pero no en la lista. Lo que se
 * borra en cascada son las filas de `ProductoCategoria`: dejar de agrupar algo
 * no es darlo de baja, así que los productos quedan enteros y con una etiqueta
 * menos.
 */
export async function borrarCategoria(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  try {
    return await prisma.categoria.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Categoría no encontrada");
    }
    throw error;
  }
}

/**
 * La ficha de una categoría, con los productos que agrupa.
 *
 * Los trae **enteros y sin paginar**: el catálogo de un vivero son decenas, no
 * miles, y una categoría existe justamente para verla completa.
 */
export async function getCategoria(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      orden: true,
      descripcion: true,
      mediaId: true,
      media: { select: { id: true, key: true, alt: true, nombre: true } },
      productos: {
        where: { producto: { deletedAt: null } },
        // Por su posición: es el orden guardado. Los otros —nombre, precio,
        // fecha— los aplica la pantalla sobre esta lista.
        orderBy: { posicion: "asc" },
        select: {
          producto: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
              estado: true,
              createdAt: true,
              // El precio del producto es el más bajo de sus variantes: es lo
              // que se muestra como "desde" y con lo que tiene sentido
              // ordenar. Un servicio no tiene ninguna.
              variantes: {
                orderBy: { precio: "asc" },
                take: 1,
                select: { precio: true },
              },
              imagenes: {
                orderBy: { posicion: "asc" },
                take: 1,
                select: { media: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!categoria) throw new NotFoundError("Categoría no encontrada");

  return {
    id: categoria.id,
    nombre: categoria.nombre,
    orden: categoria.orden,
    descripcion: categoria.descripcion,
    imagen: categoria.media
      ? {
          id: categoria.media.id,
          url: publicUrlForKey(categoria.media.key),
          alt: categoria.media.alt,
          nombre: categoria.media.nombre,
        }
      : null,
    productos: categoria.productos.map((pc) => armarFila(pc.producto)),
  };
}

/**
 * Deja la categoría con **exactamente** estos productos, **en este orden**.
 *
 * Un reemplazo y no un `add`/`remove` suelto, porque es lo que se guarda desde
 * la ficha: lo que llega es el estado final, igual que las líneas de una orden.
 *
 * El índice en el arreglo es la `posicion`. Así "guardar el orden manual" y
 * "guardar qué productos hay" son la misma operación, que es como se viven en
 * la pantalla: se arrastra una fila y se aprieta guardar.
 */
export async function fijarProductos(
  viewer: Viewer,
  categoriaId: string,
  productoIds: string[]
) {
  ensureAdmin(viewer);
  const categoria = await prisma.categoria.findUnique({
    where: { id: categoriaId },
    select: { id: true },
  });
  if (!categoria) throw new NotFoundError("Categoría no encontrada");

  const quedan = new Set(productoIds);
  const actuales = await prisma.productoCategoria.findMany({
    where: { categoriaId },
    select: { productoId: true },
  });
  const ya = new Set(actuales.map((p) => p.productoId));

  const sobran = [...ya].filter((id) => !quedan.has(id));

  await prisma.$transaction([
    ...(sobran.length
      ? [
          prisma.productoCategoria.deleteMany({
            where: { categoriaId, productoId: { in: sobran } },
          }),
        ]
      : []),
    // Un `upsert` por producto y no un `createMany`: los que ya estaban pueden
    // haber cambiado de lugar, y crear solo los nuevos dejaría el orden viejo.
    ...productoIds.map((productoId, posicion) =>
      prisma.productoCategoria.upsert({
        where: { productoId_categoriaId: { productoId, categoriaId } },
        create: { categoriaId, productoId, posicion },
        update: { posicion },
      })
    ),
  ]);

  return getCategoria(viewer, categoriaId);
}

/**
 * El catálogo entero para elegir, con su miniatura.
 *
 * Sin filtrar por categoría a propósito: el selector la usa tanto sobre una
 * categoría que existe como sobre una que se está creando, y quién ya está
 * elegido lo sabe la pantalla —incluidos los que se acaban de marcar y todavía
 * no se guardaron—.
 *
 * Incluye los borradores: ordenar el catálogo antes de vender es exactamente
 * cuándo conviene hacerlo.
 */
/**
 * Los productos que se pueden sumar a una categoría, **de a tandas**.
 *
 * Antes traía los primeros 100 y cortaba ahí, sin decirlo: con un catálogo más
 * grande había productos a los que no se llegaba ni buscándolos, porque el
 * corte era antes del filtro que ve la pantalla. Ahora se pide de a poco y se
 * sigue pidiendo al llegar al final de la lista.
 *
 * `hayMas` sale de pedir uno más de los que se van a devolver: es una sola
 * consulta en vez de un `count` aparte, y lo único que hay que saber es si
 * conviene seguir.
 */
export async function productosParaElegir(
  viewer: Viewer,
  opciones: { search?: string; offset?: number; limit?: number } = {}
) {
  ensureAdmin(viewer);
  const limit = Math.min(Math.max(opciones.limit ?? 20, 1), 100);
  const offset = Math.max(0, opciones.offset ?? 0);
  const search = opciones.search;
  const productos = await prisma.producto.findMany({
    where: {
      deletedAt: null,
      ...(search?.trim()
        ? { nombre: { contains: search.trim(), mode: "insensitive" } }
        : {}),
    },
    orderBy: { nombre: "asc" },
    skip: offset,
    take: limit + 1,
    select: {
      id: true,
      nombre: true,
      tipo: true,
      estado: true,
      createdAt: true,
      variantes: { orderBy: { precio: "asc" }, take: 1, select: { precio: true } },
      imagenes: {
        orderBy: { posicion: "asc" },
        take: 1,
        select: { media: { select: { key: true } } },
      },
    },
  });
  const hayMas = productos.length > limit;
  return { items: productos.slice(0, limit).map(armarFila), hayMas };
}

/** Una fila de producto, con lo que la ficha necesita para mostrar y ordenar. */
function armarFila(p: {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  createdAt: Date;
  variantes: { precio: Prisma.Decimal }[];
  imagenes: { media: { key: string } }[];
}) {
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    estado: p.estado,
    creadoEl: p.createdAt.toISOString(),
    // `null` en un servicio: no tiene variantes, así que no tiene precio de
    // lista, y ordenar por precio lo deja al final en vez de tratarlo como 0.
    precio: p.variantes[0] ? Number(p.variantes[0].precio) : null,
    imagenUrl: p.imagenes[0] ? publicUrlForKey(p.imagenes[0].media.key) : null,
  };
}


import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizarHtml } from "@/lib/html-seguro";
import { asegurarVarianteUnica } from "./variante.service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

const SERVICIO_LIST_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  ivaTasa: true,
  descripcion: true,
  _count: { select: { suscripcionItems: true } },
} as const;

export interface ListServiciosFilters {
  search?: string;
  cursor?: string;
  limit?: number;
}

/**
 * El código repetido lo atrapa el índice único y no una consulta previa: entre
 * el `findFirst` y el `update` hay lugar para que otra pestaña gane la carrera,
 * y la base es la única que no se equivoca.
 */
async function conCodigoUnico<T>(fn: () => Promise<T>, codigo?: string | null) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        `Ya hay un producto con el código "${codigo?.trim()}".`
      );
    }
    throw error;
  }
}

function ensureAdmin(viewer: Viewer) {
  // Servicios management is admin-only on mobile (matches the v1 plan).
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

function ensureCanReadServicios(viewer: Viewer) {
  // Reading the catalog is broader: ADMIN/STAFF + PERSONAL_ADMIN need it
  // for the asignar-servicio flow even though only ADMIN sees the dedicated
  // Servicios tab in mobile.
  if (
    !isAdminRole(viewer.role) &&
    viewer.role !== "PERSONAL_ADMIN"
  ) {
    throw new ForbiddenError();
  }
}

export async function listServicios(
  viewer: Viewer,
  filters: ListServiciosFilters = {}
) {
  ensureCanReadServicios(viewer);

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.search) {
    const q = filters.search.trim();
    if (q.length > 0) {
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const items = await prisma.producto.findMany({
    where,
    select: SERVICIO_LIST_SELECT,
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  return {
    items: slice,
    nextCursor: hasMore ? slice[slice.length - 1].id : null,
  };
}

export interface CreateServicioPayload {
  nombre: string;
  descripcion?: string | null;
  /** Qué es: un servicio que se ejecuta o un bien que se despacha. */
  tipo?: "SERVICIO" | "BIEN";
  ivaTasa?: number | null;
  /**
   * En qué categorías está. **Varias**: un rosal es "Plantas" y también
   * "Exterior", y con un solo casillero había que elegir cuál guardar.
   */
  categoriaIds?: string[];
  /**
   * Código del catálogo. Se guarda como el `sku` de la variante única, que es
   * de donde sale el `codigoPrincipal` del XML; sin él se emite uno derivado
   * del id.
   */
  codigo?: string | null;
  /** Si ya se puede vender. Nace `ACTIVO`. */
  estado?: "ACTIVO" | "BORRADOR";
}

export async function createServicio(
  viewer: Viewer,
  payload: CreateServicioPayload
) {
  ensureAdmin(viewer);

  const producto = await conCodigoUnico(
    () =>
      prisma.producto.create({
        data: {
          nombre: payload.nombre,
          // La descripción es HTML de un editor: se limpia **acá**, porque lo
          // que valida la pantalla no cuenta.
          descripcion: sanitizarHtml(payload.descripcion),
          tipo: payload.tipo ?? "SERVICIO",
          ivaTasa: payload.ivaTasa ?? null,
          categorias: payload.categoriaIds?.length
            ? { create: payload.categoriaIds.map((categoriaId) => ({ categoriaId })) }
            : undefined,
          ...(payload.estado ? { estado: payload.estado } : {}),
          createdById: viewer.id,
          updatedById: viewer.id,
        },
      }),
    payload.codigo
  );

  // **Todo producto nace con una variante**, servicios incluidos. La
  // variante es lo que se vende, y por eso ahí vive el código: sin ella, una
  // línea de orden apuntaría a un producto o a una variante según el tipo.
  //
  // Un servicio no lleva inventario, y eso lo dice `manejaInventario`, no la
  // ausencia de variante. Agregar opciones —solo un bien puede— reemplaza esta
  // única por las combinaciones.
  await asegurarVarianteUnica(producto.id, payload.codigo?.trim() || null, {
    manejaInventario: producto.tipo === "BIEN",
  });

  // El id de la variante viaja con la respuesta: la pantalla de alta le pone
  // el precio y el stock inmediatamente después, y sin esto tendría que salir
  // a buscarla.
  const variante = await prisma.variante.findFirst({
    where: { productoId: producto.id },
    select: { id: true },
  });

  return { ...producto, varianteId: variante?.id ?? null };
}

export interface UpdateServicioPayload {
  nombre?: string;
  descripcion?: string | null;
  /** Se acepta para poder validarlo, pero no se puede cambiar. */
  tipo?: "SERVICIO" | "BIEN";
  ivaTasa?: number | null;
  /** En qué categorías está. Reemplaza el conjunto entero. */
  categoriaIds?: string[];
  /** El que sale impreso como `codigoPrincipal`. Va al `sku` de la variante. */
  codigo?: string | null;
  /** Si ya se puede vender. Un borrador no aparece en los selectores. */
  estado?: "ACTIVO" | "BORRADOR";
}

export async function updateServicio(
  productoId: string,
  viewer: Viewer,
  payload: UpdateServicioPayload
) {
  ensureAdmin(viewer);

  const actual = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { tipo: true },
  });
  if (!actual) throw new NotFoundError("Producto no encontrado");

  // `tipo` es inmutable: cambiarlo dejaría suscripciones, visitas y
  // líneas de orden con una semántica que ya no corresponde — un UNICO cobrado
  // por trabajo no puede volverse una suscripción mensual sin reinterpretar
  // todo lo ya facturado.
  if (payload.tipo !== undefined && payload.tipo !== actual.tipo) {
    throw new ValidationError(
      "El tipo no se puede cambiar después de crear el producto."
    );
  }

  const actualizado = await conCodigoUnico(
    () =>
      prisma.producto.update({
        where: { id: productoId },
        data: {
          ...(payload.nombre !== undefined ? { nombre: payload.nombre } : {}),
          ...(payload.descripcion !== undefined
            ? { descripcion: sanitizarHtml(payload.descripcion) }
            : {}),
          ...(payload.ivaTasa !== undefined ? { ivaTasa: payload.ivaTasa } : {}),
          ...(payload.categoriaIds !== undefined
            ? {
                // Reemplazo entero, no un parche: lo que llega es el estado
                // final, igual que las líneas de una orden.
                categorias: {
                  deleteMany: {},
                  create: payload.categoriaIds.map((categoriaId) => ({
                    categoriaId,
                  })),
                },
              }
            : {}),
          ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
          updatedById: viewer.id,
        },
      }),
    payload.codigo
  );

  // El código vive en la variante. Se escribe solo cuando el producto tiene
  // **una sola**: con varias, cada una tiene su propio SKU y no hay un "el
  // código del producto" que actualizar — eso se edita en la ficha de cada una.
  if (payload.codigo !== undefined) {
    const variantes = await prisma.variante.findMany({
      where: { productoId },
      select: { id: true },
    });
    if (variantes.length === 1) {
      await conCodigoUnico(
        () =>
          prisma.variante.update({
            where: { id: variantes[0].id },
            data: { sku: payload.codigo?.trim() || null },
          }),
        payload.codigo
      );
    }
  }

  return actualizado;
}

export async function getServicio(productoId: string, viewer: Viewer) {
  ensureCanReadServicios(viewer);
  const servicio = await prisma.producto.findFirst({
    where: { id: productoId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      tipo: true,
      createdAt: true,
      _count: { select: { suscripcionItems: true } },
    },
  });
  if (!servicio) throw new NotFoundError("Servicio no encontrado");
  return servicio;
}

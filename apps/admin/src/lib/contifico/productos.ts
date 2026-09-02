/**
 * Sincronización del catálogo con los productos de Contífico.
 *
 * `detalles[].producto_id` es obligatorio al facturar y no existen líneas de
 * texto libre, así que cada `Producto` del portal tiene que tener su par en
 * Contífico **antes** de poder venderse.
 *
 * La sincronización es siempre **a pedido**, nunca automática, por dos razones:
 * Contífico no permite borrar productos (solo desactivarlos), así que todo lo
 * que se empuja queda en su catálogo para siempre; y como ya tienen catálogo
 * cargado, lo normal es **vincular** a lo que existe en vez de crear un
 * duplicado. Crear es el último recurso.
 */
import { prisma } from "@/lib/prisma";
import type { Producto } from "@/generated/prisma/client";
import {
  ContificoError,
  contificoRequest,
  esProductoDuplicado,
} from "./client";
import { camposParaCrear, codigoParaProducto } from "./campos";

export { codigoParaProducto };

export interface ContificoProducto {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "PRO" | "SER";
  porcentaje_iva: number | null;
  pvp1: string;
  estado: string;
  categoria_id: string | null;
}



/** Busca por código exacto. Nunca listar sin filtro: la API se cuelga. */
export async function buscarPorCodigo(
  codigo: string
): Promise<ContificoProducto | null> {
  const items = await contificoRequest<ContificoProducto[]>("/producto/", {
    query: { codigo },
  });
  return items?.[0] ?? null;
}

/**
 * Búsqueda por nombre, código o categoría, para vincular a mano.
 *
 * Exige al menos 3 caracteres a propósito: `GET /producto/` sin filtro (o con
 * uno demasiado amplio) intenta devolver el catálogo entero y hace timeout.
 */
export const MIN_BUSQUEDA = 3;

export async function buscarProductos(
  termino: string
): Promise<ContificoProducto[]> {
  const q = termino.trim();
  if (q.length < MIN_BUSQUEDA) return [];
  return (
    (await contificoRequest<ContificoProducto[]>("/producto/", {
      query: { filtro: q },
    })) ?? []
  );
}

/**
 * Renombra un producto en Contífico.
 *
 * Verificado contra la API real: `PATCH /producto/<id>/ {nombre}` aplica el
 * cambio y responde **200 con cuerpo vacío** — no devuelve el producto.
 *
 * Importa porque `detalles[]` de una factura no lleva descripción: lo que se
 * imprime en el SRI es el nombre que Contífico tiene guardado, no el del
 * portal. Si los nombres difieren, la factura muestra el de ellos.
 */
export async function actualizarNombreEnContifico(
  contificoProductoId: string,
  nombre: string
): Promise<void> {
  await contificoRequest(`/producto/${contificoProductoId}/`, {
    method: "PATCH",
    body: { nombre },
  });
}

/**
 * Vincula un producto del portal con uno que **ya existe** en Contífico.
 *
 * Es el camino preferido: no escribe nada en el catálogo ajeno, salvo que se
 * pida `actualizarNombre`. Se guarda también el código del producto de
 * Contífico, así la llave anti-duplicados pasa a ser la de ellos y no una
 * inventada por nosotros.
 */
export async function vincularProducto(
  productoId: string,
  contifico: { id: string; codigo: string },
  opciones: { actualizarNombre?: boolean } = {}
): Promise<{ codigo: string; contificoProductoId: string }> {
  const yaVinculado = await prisma.producto.findFirst({
    where: { contificoProductoId: contifico.id, id: { not: productoId } },
    select: { id: true, nombre: true, deletedAt: true },
  });
  // Dos productos del portal no pueden apuntar al mismo de Contífico: el
  // `producto_id` de la factura dejaría de decir qué se vendió, y la columna
  // es única, así que sin este corte el choque salía como un error de base.
  if (yaVinculado && !yaVinculado.deletedAt) {
    throw new ContificoError(
      `Ese producto de Contífico ya está vinculado a "${yaVinculado.nombre}".`,
      409
    );
  }

  if (opciones.actualizarNombre) {
    const propio = await prisma.producto.findUniqueOrThrow({
      where: { id: productoId },
      select: { nombre: true },
    });
    // Antes de guardar: si renombrar falla, el vínculo no se hace y el usuario
    // ve el error, en vez de quedar vinculado creyendo que se renombró.
    await actualizarNombreEnContifico(contifico.id, propio.nombre);
  }

  // Un archivado que lo tenía lo suelta, y en la misma transacción: archivar
  // no libera el vínculo —el producto sigue existiendo, con su historia—, así
  // que sin esto un producto de Contífico quedaba tomado para siempre por una
  // ficha que ya no se ve en ningún lado. `codigo` se va con él: también es
  // único, y suelto no dice nada.
  await prisma.$transaction([
    ...(yaVinculado
      ? [
          prisma.producto.update({
            where: { id: yaVinculado.id },
            data: { contificoProductoId: null, codigo: null },
          }),
        ]
      : []),
    prisma.producto.update({
      where: { id: productoId },
      data: { contificoProductoId: contifico.id, codigo: contifico.codigo },
    }),
  ]);
  return { codigo: contifico.codigo, contificoProductoId: contifico.id };
}

/** Deshace el vínculo. El producto sigue existiendo en Contífico. */
export async function desvincularProducto(productoId: string): Promise<void> {
  await prisma.producto.update({
    where: { id: productoId },
    data: { contificoProductoId: null, codigo: null },
  });
}

/**
 * **Crea** el producto en Contífico y devuelve su id.
 *
 * Solo para cuando de verdad no existe allá: preferí `vincularProducto()`.
 * Es idempotente sin necesidad de buscar primero: si el código ya existe,
 * Contífico devuelve 409 **con el id del existente**, y ese id se guarda igual.
 */
export async function sincronizarProducto(
  producto: Pick<
    Producto,
    "id" | "nombre" | "descripcion" | "tipo" | "codigo" | "ivaTasa" | "contificoProductoId" | "contificoCategoriaId"
  >,
  /** Crear aunque ya haya vínculo. Es el "crear nuevo" del diálogo de cambio. */
  forzar = false
): Promise<string> {
  if (producto.contificoProductoId && !forzar) {
    return producto.contificoProductoId;
  }

  // Con qué categoría de Contífico nace. La del producto si ya la tiene; si no,
  // la que dice su categoría del portal.
  //
  // **No es cosmético.** Allá la categoría lleva la `cuenta_venta` y el
  // producto la hereda, así que es lo que decide en qué cuenta cae la venta.
  // Sin mandar ninguna, Contífico les pone su categoría por defecto —de tipo
  // PROD—, y por eso los servicios que creaba el portal se contabilizaban como
  // venta de bienes.
  const categoriaId =
    producto.contificoCategoriaId ??
    (
      await prisma.producto.findUnique({
        where: { id: producto.id },
        select: { categoria: { select: { contificoCategoriaId: true } } },
      })
    )?.categoria?.contificoCategoriaId ??
    null;

  // Los mismos campos que la UI muestra en el resumen de confirmación.
  const cuerpo = camposParaCrear({
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    tipo: producto.tipo,
    ivaTasa: producto.ivaTasa != null ? Number(producto.ivaTasa) : null,
    contificoCategoriaId: categoriaId,
  });
  const codigo = cuerpo.codigo;
  let contificoId: string;

  try {
    const creado = await contificoRequest<{ id: string }>("/producto/", {
      method: "POST",
      body: cuerpo,
    });
    contificoId = creado.id;
  } catch (error) {
    if (esProductoDuplicado(error) && error.id) {
      // Ya existía: nos quedamos con el id que devuelve el propio 409.
      contificoId = error.id;
    } else {
      throw error;
    }
  }

  await prisma.producto.update({
    where: { id: producto.id },
    data: {
      contificoProductoId: contificoId,
      codigo,
      // Con cuál se creó, para saber después en qué cuenta cayó sin tener que
      // preguntárselo a su API.
      ...(categoriaId ? { contificoCategoriaId: categoriaId } : {}),
    },
  });
  return contificoId;
}

export interface ContificoCategoria {
  id: string;
  nombre: string;
  padre_id: string | null;
}

export async function listarCategorias(): Promise<ContificoCategoria[]> {
  return (
    (await contificoRequest<ContificoCategoria[]>("/categoria/", {
      timeoutMs: 60_000,
    })) ?? []
  );
}

export async function crearCategoria(
  nombre: string,
  padreId?: string | null
): Promise<ContificoCategoria> {
  if (!nombre.trim()) {
    throw new ContificoError("El nombre de la categoría es obligatorio.", 400);
  }
  return contificoRequest<ContificoCategoria>("/categoria/", {
    method: "POST",
    body: { nombre: nombre.trim(), padre_id: padreId ?? null },
  });
}

/**
 * Opciones y variantes de un bien.
 *
 * El modelo es el de Shopify: un producto tiene **ejes** (Color, Tamaño), cada
 * eje tiene valores, y una **variante** es una combinación concreta — "Rojo ·
 * Grande". Con dos ejes de 3 y 2 valores hay seis variantes, y cada una es lo
 * que se cuenta y lo que lleva su SKU.
 *
 * **Un bien sin opciones tiene una variante igual**, sin valores. Así todo lo
 * que pregunta "cuánto hay" mira siempre al mismo lado y no hay dos caminos
 * que mantener; el que no usa opciones nunca se entera de que existen.
 *
 * **Solo bienes.** Un servicio no tiene nada que combinar: lo que cambia de una
 * poda a otra es el precio, y eso vive en la orden.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

/** Cuántos ejes admite un producto. */
export const MAX_OPCIONES = 3;
/** Cuántas variantes puede generar una combinación. */
export const MAX_VARIANTES = 200;

export interface OpcionInput {
  /** El de la opción existente. Sin esto es nueva. */
  id?: string | null;
  nombre: string;
  valores: { id?: string | null; valor: string }[];
}

/**
 * El separador de `Variante.combinacion`.
 *
 * Un cuid no lo contiene nunca, así que la cadena no se puede volver ambigua.
 */
const SEP = "·";

/** El producto, con sus ejes y sus variantes armadas para mostrar. */
export async function getCatalogoDelProducto(viewer: Viewer, productoId: string) {
  ensureAdmin(viewer);
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      opciones: {
        orderBy: { posicion: "asc" },
        select: {
          id: true,
          nombre: true,
          posicion: true,
          valores: {
            orderBy: { posicion: "asc" },
            select: { id: true, valor: true, posicion: true },
          },
        },
      },
      variantes: {
        orderBy: { posicion: "asc" },
        select: {
          id: true,
          sku: true,
          precio: true,
          combinacion: true,
          manejaInventario: true,
          stock: true,
          permiteNegativo: true,
          imagenId: true,
          valores: {
            select: {
              valor: {
                select: {
                  id: true,
                  valor: true,
                  opcion: { select: { id: true, nombre: true, posicion: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!producto) throw new NotFoundError("Producto no encontrado");

  return {
    ...producto,
    variantes: producto.variantes.map((v) => ({
      id: v.id,
      sku: v.sku,
      // Decimal no cruza a un componente cliente.
      precio: v.precio === null ? null : Number(v.precio),
      manejaInventario: v.manejaInventario,
      stock: v.stock,
      permiteNegativo: v.permiteNegativo,
      imagenId: v.imagenId,
      /** Los valores en el orden de sus ejes: "Rojo · Grande", no al revés. */
      valores: v.valores
        .map((vv) => vv.valor)
        .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
        .map((val) => ({
          opcionId: val.opcion.id,
          opcion: val.opcion.nombre,
          valorId: val.id,
          valor: val.valor,
        })),
    })),
  };
}

/**
 * Reemplaza los ejes de un producto y **regenera sus variantes**.
 *
 * Es un reemplazo entero, como `actualizarOrden` con sus líneas: lo que llega
 * es el estado final, no un parche. Lo que sobrevive es lo que sigue teniendo
 * sentido — una variante cuya combinación no cambió conserva su SKU, su stock
 * y su foto, porque es la misma cosa aunque se haya agregado otro eje al lado.
 *
 * Los valores viajan **con su id** cuando ya existían. Sin eso, renombrar
 * "Rojo" a "Rojo intenso" sería borrar un valor y crear otro, y las variantes
 * rojas se irían con su stock por un cambio de texto.
 *
 * Sacar un eje o un valor **borra las variantes que dependían de él**. Si esas
 * variantes tienen movimientos de inventario no se hace en silencio: hace
 * falta `descartarVariantes`, y quien decide ve antes cuáles y con cuánto
 * stock — el mismo trato que anular una orden con trabajo enlazado.
 */
export async function guardarOpciones(
  viewer: Viewer,
  productoId: string,
  opciones: OpcionInput[],
  { descartarVariantes = false }: { descartarVariantes?: boolean } = {}
) {
  ensureAdmin(viewer);

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, nombre: true, tipo: true },
  });
  if (!producto) throw new NotFoundError("Producto no encontrado");
  if (producto.tipo !== "BIEN") {
    throw new ValidationError(
      "Solo un bien tiene opciones: un servicio no tiene nada que combinar."
    );
  }
  if (opciones.length > MAX_OPCIONES) {
    throw new ValidationError(
      `Un producto admite hasta ${MAX_OPCIONES} opciones.`
    );
  }

  // Se limpia y se valida todo antes de tocar nada: un eje sin valores o dos
  // ejes con el mismo nombre tienen que fallar sin haber borrado la mitad.
  const limpias = opciones.map((o, i) => {
    const nombre = o.nombre.trim();
    if (!nombre) throw new ValidationError("Cada opción necesita un nombre.");
    const valores = o.valores
      .map((v) => ({ id: v.id ?? null, valor: v.valor.trim() }))
      .filter((v) => v.valor !== "");
    if (valores.length === 0) {
      throw new ValidationError(`La opción "${nombre}" no tiene valores.`);
    }
    const vistos = new Set<string>();
    for (const v of valores) {
      const clave = v.valor.toLowerCase();
      if (vistos.has(clave)) {
        throw new ValidationError(`"${nombre}" repite el valor "${v.valor}".`);
      }
      vistos.add(clave);
    }
    return { id: o.id ?? null, nombre, posicion: i, valores };
  });

  const nombres = new Set<string>();
  for (const o of limpias) {
    const clave = o.nombre.toLowerCase();
    if (nombres.has(clave)) {
      throw new ValidationError(`Hay dos opciones llamadas "${o.nombre}".`);
    }
    nombres.add(clave);
  }

  const total = limpias.reduce((n, o) => n * o.valores.length, 1);
  if (limpias.length > 0 && total > MAX_VARIANTES) {
    throw new ValidationError(
      `Esa combinación da ${total} variantes y el tope es ${MAX_VARIANTES}. Sacá algún valor.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // Cómo se llama cada variante **antes** de tocar nada: sacar un eje borra
    // sus valores en cascada, así que leer los nombres después dejaría a
    // "Rojo · Grande" llamándose "Grande" justo en el mensaje que tiene que
    // decirle a alguien qué está por perder.
    const nombresPrevios = new Map(
      (
        await tx.variante.findMany({
          where: { productoId },
          select: {
            id: true,
            valores: {
              select: {
                valor: {
                  select: { valor: true, opcion: { select: { posicion: true } } },
                },
              },
            },
          },
        })
      ).map((v) => [
        v.id,
        v.valores
          .map((x) => x.valor)
          .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
          .map((x) => x.valor)
          .join(" · "),
      ])
    );

    const previas = await tx.opcionProducto.findMany({
      where: { productoId },
      select: { id: true, valores: { select: { id: true } } },
    });
    const idsPrevios = new Set(previas.map((o) => o.id));
    const quedan = new Set(limpias.map((o) => o.id).filter(Boolean) as string[]);

    // Los ejes que ya no vienen. Cascade se lleva sus valores.
    const aBorrar = [...idsPrevios].filter((id) => !quedan.has(id));
    if (aBorrar.length > 0) {
      await tx.opcionProducto.deleteMany({ where: { id: { in: aBorrar } } });
    }

    /** El eje ya guardado, con sus valores en el orden que llegaron. */
    const ejes: { valorIds: string[] }[] = [];

    for (const o of limpias) {
      let opcionId = o.id;
      if (opcionId && idsPrevios.has(opcionId)) {
        await tx.opcionProducto.update({
          where: { id: opcionId },
          data: { nombre: o.nombre, posicion: o.posicion },
        });
      } else {
        const creada = await tx.opcionProducto.create({
          data: { productoId, nombre: o.nombre, posicion: o.posicion },
          select: { id: true },
        });
        opcionId = creada.id;
      }

      const valoresPrevios = await tx.valorOpcion.findMany({
        where: { opcionId },
        select: { id: true },
      });
      const idsValor = new Set(valoresPrevios.map((v) => v.id));
      const sobreviven = new Set(
        o.valores.map((v) => v.id).filter(Boolean) as string[]
      );
      const valoresABorrar = [...idsValor].filter((id) => !sobreviven.has(id));
      if (valoresABorrar.length > 0) {
        await tx.valorOpcion.deleteMany({ where: { id: { in: valoresABorrar } } });
      }

      const ids: string[] = [];
      for (const [i, v] of o.valores.entries()) {
        if (v.id && idsValor.has(v.id)) {
          await tx.valorOpcion.update({
            where: { id: v.id },
            data: { valor: v.valor, posicion: i },
          });
          ids.push(v.id);
        } else {
          const creado = await tx.valorOpcion.create({
            data: { opcionId: opcionId!, valor: v.valor, posicion: i },
            select: { id: true },
          });
          ids.push(creado.id);
        }
      }
      ejes.push({ valorIds: ids });
    }

    return regenerarVariantes(tx, {
      productoId,
      productoNombre: producto.nombre,
      nombresPrevios,
      ejes,
      descartarVariantes,
    });
  });
}

/**
 * El producto cartesiano de los ejes, en su orden.
 *
 * Sin ejes devuelve una combinación vacía —la variante única— y no ninguna:
 * un bien siempre tiene dónde contarse.
 */
function combinaciones(ejes: { valorIds: string[] }[]): string[][] {
  return ejes.reduce<string[][]>(
    (acc, eje) => acc.flatMap((previa) => eje.valorIds.map((id) => [...previa, id])),
    [[]]
  );
}

async function regenerarVariantes(
  tx: Prisma.TransactionClient,
  args: {
    productoId: string;
    productoNombre: string;
    /** Cómo se llamaba cada variante antes de tocar los ejes. */
    nombresPrevios: Map<string, string>;
    ejes: { valorIds: string[] }[];
    descartarVariantes: boolean;
  }
) {
  const { productoId, productoNombre, nombresPrevios, ejes, descartarVariantes } =
    args;

  const deseadas = combinaciones(ejes).map((ids) => ({
    ids,
    clave: ids.join(SEP),
  }));
  const claves = new Set(deseadas.map((c) => c.clave));

  const existentes = await tx.variante.findMany({
    where: { productoId },
    select: {
      id: true,
      combinacion: true,
      stock: true,
      _count: { select: { movimientos: true } },
    },
  });

  const sobran = existentes.filter((v) => !claves.has(v.combinacion));

  // Una variante con historial no desaparece en silencio: su stock y sus
  // movimientos se van con ella, y eso lo tiene que decidir una persona
  // mirando cuáles son. Mismo trato que anular una orden con trabajo enlazado.
  const conHistorial = sobran.filter(
    (v) => v._count.movimientos > 0 || v.stock !== 0
  );
  if (conHistorial.length > 0 && !descartarVariantes) {
    throw new ConflictError(
      `Este cambio borra ${conHistorial.length} ${
        conHistorial.length === 1 ? "variante que tiene" : "variantes que tienen"
      } inventario: ${conHistorial
        .map((v) => `"${nombresPrevios.get(v.id) || productoNombre}" (${v.stock})`)
        .join(", ")}. Confirmá para seguir.`
    );
  }

  if (sobran.length > 0) {
    await tx.variante.deleteMany({ where: { id: { in: sobran.map((v) => v.id) } } });
  }

  const porClave = new Map(existentes.map((v) => [v.combinacion, v]));
  for (const [i, c] of deseadas.entries()) {
    const ya = porClave.get(c.clave);
    if (ya) {
      await tx.variante.update({ where: { id: ya.id }, data: { posicion: i } });
      continue;
    }
    await tx.variante.create({
      data: {
        productoId,
        combinacion: c.clave,
        posicion: i,
        valores: { create: c.ids.map((valorId) => ({ valorId })) },
      },
    });
  }

  return tx.variante.count({ where: { productoId } });
}

export interface VarianteInput {
  sku?: string | null;
  /** Precio de lista. Lo que se cobró vive en la orden, no acá. */
  precio?: number | null;
  manejaInventario?: boolean;
  permiteNegativo?: boolean;
  /** Cuál de las fotos del producto la representa. */
  imagenId?: string | null;
}

/**
 * Los datos propios de una variante. **El stock no está acá**: se mueve por el
 * libro (`inventario.service`), nunca escribiéndole encima.
 */
export async function actualizarVariante(
  viewer: Viewer,
  varianteId: string,
  payload: VarianteInput
) {
  ensureAdmin(viewer);
  const variante = await prisma.variante.findUnique({
    where: { id: varianteId },
    select: { id: true, productoId: true, stock: true },
  });
  if (!variante) throw new NotFoundError("Variante no encontrada");

  if (payload.imagenId) {
    const imagen = await prisma.productoImagen.findFirst({
      where: { id: payload.imagenId, productoId: variante.productoId },
      select: { id: true },
    });
    if (!imagen) {
      throw new ValidationError("Esa foto no es de este producto.");
    }
  }

  // Apagar el conteo con stock cargado dejaría un número que ya no se mantiene
  // y que igual se ve. Se corta acá: primero se lleva a cero, y así queda
  // anotado en el libro por qué dejó de haber.
  if (payload.manejaInventario === false && variante.stock !== 0) {
    throw new ValidationError(
      `Esta variante tiene ${variante.stock} en stock. Ajustala a cero antes de dejar de contarla.`
    );
  }

  try {
    return await prisma.variante.update({
      where: { id: varianteId },
      data: {
        ...(payload.sku !== undefined ? { sku: payload.sku?.trim() || null } : {}),
        ...(payload.precio !== undefined ? { precio: payload.precio } : {}),
        ...(payload.manejaInventario !== undefined
          ? { manejaInventario: payload.manejaInventario }
          : {}),
        ...(payload.permiteNegativo !== undefined
          ? { permiteNegativo: payload.permiteNegativo }
          : {}),
        ...(payload.imagenId !== undefined ? { imagenId: payload.imagenId } : {}),
      },
    });
  } catch (error) {
    // El SKU repetido lo atrapa el índice único y no una consulta previa: entre
    // el `findFirst` y el `update` otra pestaña puede ganar la carrera.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(`Ya hay una variante con el SKU "${payload.sku}".`);
    }
    throw error;
  }
}

/**
 * Le da a un bien su variante única, si todavía no tiene ninguna.
 *
 * Un bien nace sin variantes porque el producto se crea antes de que nadie
 * piense en opciones. Esto es lo que hace que igual tenga dónde contarse.
 */
export async function asegurarVarianteUnica(productoId: string, sku?: string | null) {
  const hay = await prisma.variante.count({ where: { productoId } });
  if (hay > 0) return;
  await prisma.variante.create({
    data: { productoId, combinacion: "", sku: sku?.trim() || null },
  });
}

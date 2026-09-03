/**
 * El stock, y por qué es el que es.
 *
 * **Se lleva en un libro**, igual que las ventas. Un número suelto contesta
 * "cuánto hay" y ninguna otra pregunta: quién lo cambió, cuándo, y contra qué.
 * Cuando alguien discute un conteo, lo que se mira es esto.
 *
 * `Variante.stock` es el saldo que este libro mantiene — nunca se le escribe
 * encima desde otro lado. Todo pasa por `moverStock()`, que suma el
 * movimiento y deja el saldo actualizado en la misma transacción.
 */
import { prisma } from "@/lib/prisma";
import type { MotivoMovimiento, Prisma } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

export interface MovimientoInput {
  /** Positivo entra, negativo sale. Nunca cero: eso no es un movimiento. */
  cantidad: number;
  motivo: MotivoMovimiento;
  nota?: string | null;
  /** Contra qué factura, en una venta o una devolución. */
  facturaId?: string | null;
  /**
   * Anota aunque deje el stock en negativo.
   *
   * **Solo para lo que ya pasó.** Una venta se decide *antes* de emitir
   * (`ensureStockParaVender`); una vez que el SRI autorizó, el comprobante no
   * se puede deshacer, así que negarse a anotar la salida no evitaría nada —
   * dejaría el stock mintiendo sobre mercadería que ya salió por la puerta.
   */
  forzar?: boolean;
}

/**
 * Mueve el stock de una variante y lo deja anotado.
 *
 * Toma la fila con `FOR UPDATE` antes de leer el saldo: dos ajustes a la vez
 * sobre la misma variante tienen que serializarse, o los dos leen 10, los dos
 * escriben 12, y uno de los movimientos queda contado en el libro pero no en
 * el saldo.
 */
export async function moverStock(
  viewer: Viewer,
  varianteId: string,
  entrada: MovimientoInput,
  tx?: Prisma.TransactionClient
) {
  ensureAdmin(viewer);
  const cantidad = Math.trunc(entrada.cantidad);
  if (cantidad === 0) {
    throw new ValidationError("El movimiento tiene que ser distinto de cero.");
  }

  const correr = async (db: Prisma.TransactionClient) => {
    // `FOR UPDATE` sobre la fila, que es lo que serializa dos movimientos
    // simultáneos. Prisma no lo expone, así que va como SQL.
    const filas = await db.$queryRaw<
      { id: string; stock: number; manejaInventario: boolean; permiteNegativo: boolean }[]
    >`SELECT "id", "stock", "manejaInventario", "permiteNegativo"
      FROM "Variante" WHERE "id" = ${varianteId} FOR UPDATE`;
    const variante = filas[0];
    if (!variante) throw new NotFoundError("Variante no encontrada");

    if (!variante.manejaInventario) {
      throw new ValidationError(
        "Esta variante no lleva inventario. Prendé el conteo antes de moverle stock."
      );
    }

    const saldo = variante.stock + cantidad;
    if (saldo < 0 && !variante.permiteNegativo && !entrada.forzar) {
      throw new ValidationError(
        `No alcanza el stock: hay ${variante.stock} y se quieren sacar ${-cantidad}.`
      );
    }

    const movimiento = await db.movimientoInventario.create({
      data: {
        varianteId,
        cantidad,
        saldo,
        motivo: entrada.motivo,
        nota: entrada.nota?.trim() || null,
        facturaId: entrada.facturaId ?? null,
        createdById: viewer.id,
        createdByNombre: viewer.nombre ?? null,
      },
      select: { id: true, cantidad: true, saldo: true, motivo: true, createdAt: true },
    });
    await db.variante.update({ where: { id: varianteId }, data: { stock: saldo } });
    return movimiento;
  };

  return tx ? correr(tx) : prisma.$transaction(correr);
}

/**
 * Deja el stock en el número contado.
 *
 * Un conteo dice *cuánto hay*, no *cuánto entró*: quien cuenta el estante no
 * sabe la diferencia contra el sistema, y hacérsela calcular es pedirle que
 * haga a mano la única cuenta que la máquina no puede errar. Se guarda como el
 * movimiento que lleva de un número al otro, así que el libro sigue cerrando.
 */
export async function contarStock(
  viewer: Viewer,
  varianteId: string,
  contado: number,
  nota?: string | null
) {
  ensureAdmin(viewer);
  const entero = Math.trunc(contado);
  if (entero < 0) {
    throw new ValidationError("Un conteo no puede ser negativo.");
  }
  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<{ stock: number; manejaInventario: boolean }[]>`
      SELECT "stock", "manejaInventario" FROM "Variante"
      WHERE "id" = ${varianteId} FOR UPDATE`;
    const variante = filas[0];
    if (!variante) throw new NotFoundError("Variante no encontrada");
    if (!variante.manejaInventario) {
      throw new ValidationError(
        "Esta variante no lleva inventario. Prendé el conteo antes de contarla."
      );
    }
    const diferencia = entero - variante.stock;
    if (diferencia === 0) {
      // Contar y que dé lo mismo no es un movimiento: no pasó nada.
      return null;
    }
    return moverStock(
      viewer,
      varianteId,
      { cantidad: diferencia, motivo: "CONTEO", nota },
      tx
    );
  });
}

/** El libro de una variante, lo último primero. */
export async function movimientosDeVariante(
  viewer: Viewer,
  varianteId: string,
  limite = 50
) {
  ensureAdmin(viewer);
  return prisma.movimientoInventario.findMany({
    where: { varianteId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limite, 1), 200),
    select: {
      id: true,
      cantidad: true,
      saldo: true,
      motivo: true,
      nota: true,
      createdAt: true,
      createdByNombre: true,
    },
  });
}

/**
 * Lo que está por agotarse: variantes que cuentan stock y tienen 0 o menos.
 *
 * Es la única pregunta de inventario que alguien se hace sin abrir un producto
 * en particular, así que vale una consulta propia.
 */
export async function sinStock(viewer: Viewer, limite = 50) {
  ensureAdmin(viewer);
  return prisma.variante.findMany({
    where: {
      manejaInventario: true,
      stock: { lte: 0 },
      producto: { deletedAt: null },
    },
    orderBy: [{ stock: "asc" }, { producto: { nombre: "asc" } }],
    take: limite,
    select: {
      id: true,
      sku: true,
      stock: true,
      producto: { select: { id: true, nombre: true } },
      valores: { select: { valor: { select: { valor: true } } } },
    },
  });
}

/**
 * ¿Se puede vender esto?
 *
 * Se pregunta **antes de emitir**, porque después no sirve de nada: un
 * comprobante que el SRI autorizó no se deshace, así que descubrir ahí que
 * falta stock dejaría la factura viva y la venta sin poder anotarse. Acá
 * todavía se puede cortar sin haber roto nada.
 *
 * Solo mira las variantes que se cuentan y que no admiten negativo: vender
 * contra pedido es una decisión ya tomada en la variante.
 */
export async function ensureStockParaVender(
  lineas: { varianteId: string | null; cantidad: number; descripcion: string }[]
): Promise<void> {
  const necesita = new Map<string, number>();
  for (const l of lineas) {
    if (!l.varianteId) continue;
    necesita.set(l.varianteId, (necesita.get(l.varianteId) ?? 0) + Math.ceil(l.cantidad));
  }
  if (necesita.size === 0) return;

  const variantes = await prisma.variante.findMany({
    where: { id: { in: [...necesita.keys()] } },
    select: {
      id: true,
      stock: true,
      manejaInventario: true,
      permiteNegativo: true,
      sku: true,
      producto: { select: { nombre: true } },
      valores: { select: { valor: { select: { valor: true } } } },
    },
  });

  const faltantes = variantes
    .filter((v) => v.manejaInventario && !v.permiteNegativo)
    .filter((v) => v.stock < (necesita.get(v.id) ?? 0));

  if (faltantes.length === 0) return;

  const nombres = faltantes.map((v) => {
    const combo = v.valores.map((x) => x.valor.valor).join(" · ");
    const nombre = combo ? `${v.producto.nombre} · ${combo}` : v.producto.nombre;
    return `"${nombre}" (hay ${v.stock}, se venden ${necesita.get(v.id)})`;
  });
  throw new ValidationError(
    `No alcanza el stock: ${nombres.join(", ")}. Cargá inventario, o dejá que la variante se venda sin stock.`
  );
}

/**
 * Anota la salida de lo que se acaba de facturar.
 *
 * Va **después** de que el SRI autorizó y con `forzar`: la venta ya es un
 * hecho, así que el libro la registra pase lo que pase. La decisión de si se
 * podía vender ya se tomó en `ensureStockParaVender()`, antes de emitir.
 */
export async function descontarPorVenta(
  viewer: Viewer,
  facturaId: string,
  numero: string,
  lineas: { varianteId: string | null; cantidad: number }[],
  tx: Prisma.TransactionClient
): Promise<void> {
  await moverPorFactura(viewer, facturaId, numero, lineas, tx, -1, "VENTA");
}

/** Lo devuelve al estante cuando una nota de crédito anula la factura. */
export async function devolverPorNotaDeCredito(
  viewer: Viewer,
  facturaId: string,
  numero: string,
  lineas: { varianteId: string | null; cantidad: number }[],
  tx: Prisma.TransactionClient
): Promise<void> {
  await moverPorFactura(viewer, facturaId, numero, lineas, tx, 1, "DEVOLUCION");
}

async function moverPorFactura(
  viewer: Viewer,
  facturaId: string,
  numero: string,
  lineas: { varianteId: string | null; cantidad: number }[],
  tx: Prisma.TransactionClient,
  signo: 1 | -1,
  motivo: "VENTA" | "DEVOLUCION"
): Promise<void> {
  // Una variante puede aparecer en dos líneas de la misma factura; se mueve
  // una sola vez, o el libro contaría dos salidas para una venta.
  const porVariante = new Map<string, number>();
  for (const l of lineas) {
    if (!l.varianteId) continue;
    porVariante.set(
      l.varianteId,
      (porVariante.get(l.varianteId) ?? 0) + Math.ceil(l.cantidad)
    );
  }
  if (porVariante.size === 0) return;

  const cuentan = await tx.variante.findMany({
    where: { id: { in: [...porVariante.keys()] }, manejaInventario: true },
    select: { id: true },
  });

  for (const { id } of cuentan) {
    await moverStock(
      viewer,
      id,
      {
        cantidad: signo * porVariante.get(id)!,
        motivo,
        facturaId,
        nota: `Factura ${numero}`,
        forzar: true,
      },
      tx
    );
  }
}

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { descontarPorVenta, registrarMovimiento } from "./inventario.service";
import { ValidationError } from "./errors";

/**
 * **El stock que aparta un pedido de la app.**
 *
 * El cliente pide desde el carrito y la mercadería se aparta en ese momento
 * —baja el stock, con un `RESERVA` en el libro ligado al pedido—, así dos
 * clientes no compran la misma última maceta. Desde ahí, una sola regla:
 * `sincronizarReserva` lleva lo apartado por el pedido a lo que **debería**
 * tener apartado, moviendo solo la diferencia.
 *
 * - Pedir: lo de sus líneas.
 * - Editar el borrador: lo de las líneas nuevas (si se achicó, vuelve lo que
 *   sobra; si creció, se aparta lo que falta).
 * - Anular: nada, así que vuelve todo (`LIBERACION`).
 * - Facturar: nada, y la factura anota su `VENTA` como siempre. El saldo no
 *   cambia —lo que se liberó es lo que se vende— y el libro sigue diciendo qué
 *   factura vendió qué.
 *
 * Lo apartado no se guarda en una columna: es la suma de los movimientos del
 * pedido, que es lo único que no puede desfasarse del libro.
 */

type Linea = { varianteId?: string | null; cantidad: number };

/**
 * No alcanza el stock para apartar: lleva **qué** falta, para que quien pide
 * (el cliente en la app) reciba un mensaje propio y no el de la oficina.
 */
export class StockInsuficienteError extends ValidationError {
  constructor(readonly faltan: string[]) {
    super(`No alcanza el stock: ${faltan.join(", ")}.`);
    this.name = "StockInsuficienteError";
  }
}

/**
 * Bloquea las variantes **al empezar** la transacción, siempre en el mismo
 * orden. Sin esto dos pedidos de la última unidad se trababan entre sí: cada
 * uno creaba sus líneas —que dejan una traba compartida sobre la variante— y
 * después pedía bloquearla para descontar, y Postgres cortaba uno con
 * *deadlock detected*. Bloqueadas primero, el segundo espera al primero, lee
 * el stock que dejó y se rechaza diciendo qué falta.
 */
export async function bloquearVariantes(
  tx: Prisma.TransactionClient,
  ids: string[]
): Promise<void> {
  const unicos = [...new Set(ids)].sort();
  if (unicos.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "Variante" WHERE "id" = ANY(${unicos}::text[]) ORDER BY "id" FOR UPDATE`;
}
import type { Autor } from "./inventario.service";

/** Cuánto tiene apartado el pedido, por variante (en positivo). */
export async function apartadoDelPedido(
  tx: Prisma.TransactionClient | typeof prisma,
  ordenId: string
): Promise<Map<string, number>> {
  const filas = await tx.movimientoInventario.groupBy({
    by: ["varianteId"],
    where: { ordenId, motivo: { in: ["RESERVA", "LIBERACION"] } },
    _sum: { cantidad: true },
  });
  // Las reservas restan del stock, así que lo apartado es el negativo.
  return new Map(
    filas
      .map((f) => [f.varianteId, -(f._sum.cantidad ?? 0)] as const)
      .filter(([, n]) => n !== 0)
  );
}

/**
 * Lleva lo apartado al objetivo. `validar` pide que alcance el stock para lo
 * que hay que apartar de más (las variantes que permiten negativo pasan
 * igual); sin validar, se anota pase lo que pase —liberar nunca falla—.
 */
export async function sincronizarReserva(
  tx: Prisma.TransactionClient,
  ordenId: string,
  objetivo: Linea[],
  autor: Autor,
  { validar }: { validar: boolean }
): Promise<void> {
  const quiere = new Map<string, number>();
  for (const l of objetivo) {
    if (!l.varianteId) continue;
    quiere.set(l.varianteId, (quiere.get(l.varianteId) ?? 0) + Math.ceil(l.cantidad));
  }
  const tiene = await apartadoDelPedido(tx, ordenId);

  const ids = [...new Set([...quiere.keys(), ...tiene.keys()])];
  if (ids.length === 0) return;
  // Leer el stock con las filas bloqueadas: si otro pedido está apartando lo
  // mismo, se espera a que termine y se lee lo que dejó.
  await bloquearVariantes(tx, ids);
  // Solo se aparta lo que se cuenta: una variante sin inventario no tiene
  // stock que apartar ni que devolver.
  const variantes = await tx.variante.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      stock: true,
      manejaInventario: true,
      permiteNegativo: true,
      producto: { select: { nombre: true } },
      valores: { select: { valor: { select: { valor: true } } } },
    },
  });

  const faltan: string[] = [];
  for (const v of variantes) {
    if (!v.manejaInventario) continue;
    const actual = tiene.get(v.id) ?? 0;
    const meta = quiere.get(v.id) ?? 0;
    const diferencia = meta - actual;
    if (diferencia === 0) continue;

    if (diferencia > 0) {
      if (validar && !v.permiteNegativo && v.stock < diferencia) {
        const combo = v.valores.map((x) => x.valor.valor).join(" · ");
        const nombre = combo ? `${v.producto.nombre} · ${combo}` : v.producto.nombre;
        faltan.push(v.stock > 0 ? `${nombre} (${v.stock} en stock)` : `${nombre} (agotado)`);
        continue;
      }
      await registrarMovimiento(
        autor,
        v.id,
        { cantidad: -diferencia, motivo: "RESERVA", ordenId, forzar: true },
        tx
      );
    } else {
      await registrarMovimiento(
        autor,
        v.id,
        { cantidad: -diferencia, motivo: "LIBERACION", ordenId, forzar: true },
        tx
      );
    }
  }

  if (faltan.length > 0) throw new StockInsuficienteError(faltan);
}

/**
 * **La factura quedó autorizada**: la mercadería salió. Anota la `VENTA`,
 * convierte en venta lo que el pedido tenía apartado (lo libera, así el saldo
 * no cambia) y confirma la orden.
 *
 * Es una sola función para los tres caminos por los que se autoriza una
 * factura —en el momento de emitir, con *Consultar al SRI*, o por el cron—
 * porque eran dos y solo el primero anotaba la salida: lo que se autorizaba
 * tarde confirmaba la orden y el stock no bajaba nunca. Se llama **una vez por
 * factura**, cuando pasa a `AUTORIZADO`.
 */
export async function alAutorizarLaFactura(
  tx: Prisma.TransactionClient,
  facturaId: string,
  autor: Autor
): Promise<void> {
  const f = await tx.factura.findUnique({
    where: { id: facturaId },
    select: {
      numero: true,
      ordenId: true,
      orden: { select: { stockReservado: true } },
      lineas: { select: { varianteId: true, cantidad: true } },
    },
  });
  if (!f) return;
  if (f.orden.stockReservado) {
    await sincronizarReserva(tx, f.ordenId, [], autor, { validar: false });
  }
  await descontarPorVenta(
    { id: autor.id, nombre: autor.nombre },
    facturaId,
    f.numero,
    f.lineas.map((l) => ({ varianteId: l.varianteId, cantidad: Number(l.cantidad) })),
    tx
  );
  await tx.orden.updateMany({
    where: { id: f.ordenId, estado: "BORRADOR" },
    data: { estado: "CONFIRMADA" },
  });
  await tx.orden.update({ where: { id: f.ordenId }, data: { stockReservado: false } });
}

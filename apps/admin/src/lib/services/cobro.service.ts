/**
 * Los cobros de una factura propia.
 *
 * El portal lleva su propia cuenta corriente desde que emite sin Contífico. De
 * una factura de ellos los cobros siguen viviendo allá —el portal los manda y
 * relee el saldo—, así que acá solo entran las nuestras: dos sistemas anotando
 * el mismo pago sería la forma más rápida de que ninguno tenga razón.
 *
 * **El saldo se recalcula desde los cobros, siempre.** Restarle el monto al
 * saldo guardado parece más simple hasta que un cobro se borra, se corrige o se
 * registran dos a la vez: sumar lo que hay no puede quedar mal.
 */
import { Prisma } from "@/generated/prisma/client";
import type { FormaPago } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { ensureCanWrite } from "./factura-permisos";
import { getOrden } from "./orden.service";

export interface CobroPropioInput {
  monto: number;
  formaPago: FormaPago;
  /** El día que entró la plata, que puede no ser el día que se registra. */
  fecha?: Date | null;
  referencia?: string | null;
  nota?: string | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Deja el saldo igual al total menos lo cobrado. */
async function recalcularSaldo(
  tx: Prisma.TransactionClient,
  facturaId: string
): Promise<number> {
  const factura = await tx.factura.findUniqueOrThrow({
    where: { id: facturaId },
    select: { total: true },
  });
  const { _sum } = await tx.cobro.aggregate({
    where: { facturaId },
    _sum: { monto: true },
  });
  const cobrado = Number(_sum.monto ?? 0);
  const saldo = centavos(Number(factura.total) - cobrado);
  await tx.factura.update({
    where: { id: facturaId },
    data: { saldo },
  });
  return saldo;
}

async function facturaPropia(viewer: Viewer, facturaId: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      numero: true,
      tipo: true,
      estado: true,
      anulada: true,
      total: true,
      saldo: true,
      claveAcceso: true,
      ordenId: true,
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  await getOrden(viewer, factura.ordenId);

  if (!factura.claveAcceso) {
    throw new ValidationError(
      "Esta factura la emitió Contífico: sus cobros se registran allá."
    );
  }
  if (factura.tipo === "NOTA_CREDITO") {
    throw new ValidationError("Una nota de crédito no se cobra: devuelve.");
  }
  if (factura.anulada) {
    throw new ConflictError(`La factura ${factura.numero} está anulada.`);
  }
  return factura;
}

export async function registrarCobroPropio(
  viewer: Viewer,
  facturaId: string,
  cobro: CobroPropioInput
) {
  ensureCanWrite(viewer);
  const factura = await facturaPropia(viewer, facturaId);

  // Antes de la autorización no hay comprobante: cobrar contra algo que el SRI
  // no aceptó es anotar plata contra un documento que puede no existir.
  if (factura.estado !== "AUTORIZADO") {
    throw new ValidationError(
      "El SRI todavía no autorizó esta factura, así que no hay contra qué cobrar."
    );
  }

  const monto = centavos(cobro.monto);
  if (!(monto > 0)) {
    throw new ValidationError("El cobro tiene que ser mayor que cero.");
  }
  const saldo = Number(factura.saldo ?? factura.total);
  // El milésimo de tolerancia es por el redondeo, no por generosidad.
  if (monto > saldo + 0.001) {
    throw new ValidationError(
      `El cobro ($${monto.toFixed(2)}) supera lo que falta de la factura ($${saldo.toFixed(2)}).`
    );
  }

  return prisma.$transaction(async (tx) => {
    const creado = await tx.cobro.create({
      data: {
        facturaId,
        monto,
        formaPago: cobro.formaPago,
        fecha: cobro.fecha ?? new Date(),
        referencia: cobro.referencia?.trim() || null,
        nota: cobro.nota?.trim() || null,
        createdById: viewer.id,
        createdByNombre: viewer.nombre,
      },
    });
    const nuevoSaldo = await recalcularSaldo(tx, facturaId);
    return { cobroId: creado.id, saldo: nuevoSaldo };
  });
}

/**
 * Borra un cobro y devuelve el saldo.
 *
 * Se borra en vez de corregirse porque un cobro es un hecho: o entró esa plata
 * o no. Corregir el monto de uno mal cargado sería inventar un tercer estado
 * entre "pasó" y "no pasó".
 */
export async function borrarCobroPropio(
  viewer: Viewer,
  facturaId: string,
  cobroId: string
) {
  ensureCanWrite(viewer);
  await facturaPropia(viewer, facturaId);

  return prisma.$transaction(async (tx) => {
    const borrados = await tx.cobro.deleteMany({
      where: { id: cobroId, facturaId },
    });
    if (borrados.count === 0) throw new NotFoundError("Cobro no encontrado");
    const saldo = await recalcularSaldo(tx, facturaId);
    return { saldo };
  });
}

/** Los cobros de una factura propia, del más nuevo al más viejo. */
export async function cobrosPropios(viewer: Viewer, facturaId: string) {
  await facturaPropia(viewer, facturaId);
  return prisma.cobro.findMany({
    where: { facturaId },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fecha: true,
      monto: true,
      formaPago: true,
      referencia: true,
      nota: true,
      createdByNombre: true,
    },
  });
}

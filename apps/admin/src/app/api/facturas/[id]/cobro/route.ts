import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { registrarCobro } from "@/lib/services/factura.service";
import { registrarCobroPropio } from "@/lib/services/cobro.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El cobro de una factura propia. Nada que ver con el de Contífico: acá no hay
 * cuenta bancaria de ellos ni datáfono que declarar, porque el pago no viaja a
 * ningún lado — es la cuenta corriente del vivero.
 */
const cobroPropioSchema = z.object({
  monto: z.number().positive("El cobro tiene que ser mayor que cero"),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]),
  /** `YYYY-MM-DD`. Sin esto, hoy. */
  fecha: z.string().min(1).nullable().optional(),
  referencia: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

const cobroSchema = z.object({
  formaCobro: z.enum(["EF", "CQ", "TRA", "TC"]),
  monto: z.number().positive(),
  fecha: z.string().min(1).nullable().optional(),
  numeroCheque: z.string().min(1).nullable().optional(),
  cuentaBancariaId: z.string().min(1).nullable().optional(),
  /// D datafast, M medianet, E dataexpress, P placetopay, A alignet.
  tipoPing: z.enum(["D", "M", "E", "P", "A"]).nullable().optional(),
  numeroComprobante: z.string().min(1).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const cuerpo = await request.json();

  // Quién lleva los cobros depende de quién emitió: los de una factura de
  // Contífico viven allá, los de una propia acá. Lo decide el servidor y no la
  // pantalla, para que no haya forma de anotar el mismo pago en los dos lados.
  const factura = await prisma.factura.findUnique({
    where: { id },
    select: { claveAcceso: true },
  });
  if (!factura) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  if (factura.claveAcceso) {
    const parsed = cobroPropioSchema.safeParse(cuerpo);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    try {
      return NextResponse.json(
        await registrarCobroPropio(viewer, id, {
          monto: parsed.data.monto,
          formaPago: parsed.data.formaPago,
          fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : null,
          referencia: parsed.data.referencia,
          nota: parsed.data.nota,
        })
      );
    } catch (error) {
      return serviceErrorResponse(error);
    }
  }

  const parsed = cobroSchema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await registrarCobro(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

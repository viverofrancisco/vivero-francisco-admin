import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { registrarCobroPropio } from "@/lib/services/cobro.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El cobro de una factura.
 *
 * No hay cuenta bancaria ni datáfono que declarar: el pago no viaja a ningún
 * lado —al SRI la forma de pago se le declara **al emitir**— así que esto es la
 * cuenta corriente del vivero.
 */
const cobroSchema = z.object({
  monto: z.number().positive("El cobro tiene que ser mayor que cero"),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]),
  /** `YYYY-MM-DD`. Sin esto, hoy. */
  fecha: z.string().min(1).nullable().optional(),
  referencia: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = cobroSchema.safeParse(await request.json());
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

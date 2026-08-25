import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { cobrarOrden } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

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

/**
 * Cobrar la orden: confirma, emite la factura y registra el cobro.
 *
 * Es el mismo cobro que `/api/facturas/[id]/cobro`, pero entrando por la orden
 * cuando su factura todavía no existe.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = cobroSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await cobrarOrden(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

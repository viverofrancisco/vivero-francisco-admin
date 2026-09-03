import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { cobrarOrden } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const cobroSchema = z.object({
  monto: z.number().positive("El cobro tiene que ser mayor que cero"),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]),
  fecha: z.string().min(1).nullable().optional(),
  referencia: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

/**
 * Cobrar la orden: emite la factura si hace falta y registra el cobro.
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
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await cobrarOrden(viewer, id, {
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

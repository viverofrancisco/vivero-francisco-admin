import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { registrarCobroPropio } from "@/lib/services/cobro.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

const cobroSchema = z.object({
  monto: z.number().positive("El cobro tiene que ser mayor que cero"),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]),
  fecha: z.string().min(1).nullable().optional(),
  referencia: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

/**
 * Registrar un cobro contra una factura, desde el teléfono. Es el mismo
 * servicio que el portal: el saldo se recalcula sumando los cobros.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = cobroSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await registrarCobroPropio(viewerFromMobileUser(userOrResponse), id, {
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

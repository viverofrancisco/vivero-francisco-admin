import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { facturarOrden } from "@/lib/services/factura.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { emitirFacturaSchema } from "@/lib/validations/factura";

/**
 * Emitir la factura de una orden desde el teléfono.
 *
 * El mismo servicio que el portal, con las líneas de la orden una a una: el
 * armador que junta varios trabajos en una sola línea sigue siendo del
 * portal, donde hay pantalla para verlo cuadrar. Devuelve 200 aunque la
 * emisión falle, con el motivo en `errorFactura`: la orden se queda en
 * borrador, que es donde se arregla la causa.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = emitirFacturaSchema.safeParse(
    (await request.json().catch(() => ({}))) ?? {}
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await facturarOrden(viewerFromMobileUser(userOrResponse), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

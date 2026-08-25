import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { facturarOrden } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Emite la factura sin cobrar: la venta a crédito.
 *
 * Devuelve 200 aunque la emisión falle, con el motivo en `errorFactura`: la
 * orden se queda en borrador, editable, y eso no es un fracaso del pedido sino
 * el estado en el que hay que arreglar la causa.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await facturarOrden(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

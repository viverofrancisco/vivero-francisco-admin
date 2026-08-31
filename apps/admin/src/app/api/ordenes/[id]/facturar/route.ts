import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { facturarOrden } from "@/lib/services/factura.service";
import { emitirFacturaSchema } from "@/lib/validations/factura";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Emite el documento de la orden sin cobrarlo: la venta a crédito.
 *
 * El cuerpo es opcional. Sin él emite las líneas de la orden una a una, que es
 * como se emitía antes de que existiera el armador; con él manda lo que armó
 * quien emite, que puede juntar varios trabajos en una sola línea o pedir un
 * documento sin factura.
 *
 * Devuelve 200 aunque la emisión falle, con el motivo en `errorFactura`: la
 * orden se queda en borrador, editable, y eso no es un fracaso del pedido sino
 * el estado en el que hay que arreglar la causa.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;

  const cuerpo = await request.json().catch(() => ({}));
  const parsed = emitirFacturaSchema.safeParse(cuerpo ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await facturarOrden(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

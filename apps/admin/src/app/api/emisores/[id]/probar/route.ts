import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { emitirFacturaDePrueba } from "@/lib/sri/prueba";

/**
 * Emite una factura de prueba contra el SRI con la configuración del emisor.
 *
 * Es la forma de saber si todo está bien antes de que dependa una orden: si
 * algo falla —el certificado, un dato del emisor, la conexión— el motivo vuelve
 * acá y no en medio de un cobro.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await emitirFacturaDePrueba(viewer, id));
  } catch (error) {
    // Lo que devuelve el SRI o la librería es texto útil para quien configura:
    // llega tal cual en vez de convertirse en "Error interno".
    if (error instanceof Error && error.constructor.name === "Error") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serviceErrorResponse(error);
  }
}

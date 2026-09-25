import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { consultarFacturaAlSri } from "@/lib/services/factura.service";

/**
 * Le pregunta al SRI por una factura que quedó sin resolver. La lógica vive en
 * el servicio: la app pregunta lo mismo por `/api/mobile/facturas/[id]/consultar-sri`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await consultarFacturaAlSri(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

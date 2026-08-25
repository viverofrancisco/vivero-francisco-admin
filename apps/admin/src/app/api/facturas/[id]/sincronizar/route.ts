import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { sincronizarFactura } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await sincronizarFactura(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

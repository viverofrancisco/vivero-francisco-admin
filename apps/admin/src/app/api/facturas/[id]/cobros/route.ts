import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listarCobros } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await listarCobros(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { deleteInforme, getInforme } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    const informe = await getInforme(viewer, id);
    return NextResponse.json(informe);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await deleteInforme(viewer, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

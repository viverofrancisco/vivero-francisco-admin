import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listVisitasParaInforme } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!clienteId) {
    return NextResponse.json(
      { error: "clienteId es requerido" },
      { status: 400 }
    );
  }
  try {
    const items = await listVisitasParaInforme(viewer, clienteId, {
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr) : undefined,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

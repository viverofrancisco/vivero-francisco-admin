import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { emitirFacturaDePrueba } from "@/lib/sri/prueba";

/** Gemela de `/api/emisores/[id]/probar`: una factura de prueba contra el SRI. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const { id } = await params;
  try {
    return NextResponse.json(await emitirFacturaDePrueba(viewerFromMobileUser(u), id));
  } catch (error) {
    if (error instanceof Error && error.constructor.name === "Error") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serviceErrorResponse(error);
  }
}

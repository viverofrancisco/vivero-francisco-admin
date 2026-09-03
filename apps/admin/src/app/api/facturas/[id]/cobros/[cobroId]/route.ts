import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { borrarCobroPropio } from "@/lib/services/cobro.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Borra un cobro propio y devuelve el saldo.
 *
 * Un cobro es un hecho —o entró esa plata o no— así que se borra en vez de
 * corregirse. El saldo lo recalcula el servidor desde lo que queda.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cobroId: string }> }
) {
  const viewer = await viewerFromSession();
  const { id, cobroId } = await params;
  try {
    return NextResponse.json(await borrarCobroPropio(viewer, id, cobroId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

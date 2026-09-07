import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { quitarProducto } from "@/lib/services/categoria.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Lo saca de la categoría. El producto queda entero, con una etiqueta menos. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; productoId: string }> }
) {
  const viewer = await viewerFromSession();
  const { id, productoId } = await params;
  try {
    return NextResponse.json(await quitarProducto(viewer, id, productoId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

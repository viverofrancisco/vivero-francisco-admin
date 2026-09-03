import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { borrarImagen } from "@/lib/services/producto-imagen.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Borra una foto. La variante que la señalaba queda sin foto propia y vuelve a
 * mostrar la primera del producto.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const viewer = await viewerFromSession();
  const { imagenId } = await params;
  try {
    return NextResponse.json({ imagenes: await borrarImagen(viewer, imagenId) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { quitarImagen } from "@/lib/services/producto-imagen.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Saca la foto **del producto**, no de la biblioteca: sigue disponible para
 * otro. La variante que la señalaba vuelve a mostrar la primera.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const viewer = await viewerFromSession();
  const { imagenId } = await params;
  try {
    return NextResponse.json({ imagenes: await quitarImagen(viewer, imagenId) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

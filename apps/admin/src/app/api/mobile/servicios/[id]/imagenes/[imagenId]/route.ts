import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { quitarImagen } from "@/lib/services/producto-imagen.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Saca la foto **del producto**, no de la biblioteca: sigue disponible para
 * otro. La variante que la señalaba vuelve a mostrar la primera. Gemela de
 * `DELETE /api/servicios/[id]/imagenes/[imagenId]`.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { imagenId } = await params;
  try {
    return NextResponse.json({
      imagenes: await quitarImagen(viewerFromMobileUser(userOrResponse), imagenId),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

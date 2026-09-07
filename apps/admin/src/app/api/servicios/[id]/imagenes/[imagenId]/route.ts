import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { z } from "zod/v4";
import {
  quitarImagen,
  reemplazarImagen,
} from "@/lib/services/producto-imagen.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Cambia qué archivo usa esta foto, sin moverla de lugar.
 *
 * Es lo que pasa al recortar: el recorte es otra imagen de la biblioteca y la
 * galería tiene que mostrarla sin perder su posición ni el vínculo de la
 * variante que la había elegido.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const viewer = await viewerFromSession();
  const { imagenId } = await params;
  const parsed = z
    .object({ mediaId: z.string().min(1) })
    .safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await reemplazarImagen(viewer, imagenId, parsed.data.mediaId),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

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

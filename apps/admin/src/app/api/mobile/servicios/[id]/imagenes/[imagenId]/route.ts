import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  quitarImagen,
  reemplazarImagen,
} from "@/lib/services/producto-imagen.service";
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

/**
 * Cambia **qué archivo** usa esta foto del producto, sin moverla de lugar:
 * es lo que hace falta al recortar desde el visor de la app, porque el
 * recorte es una imagen nueva de la biblioteca. Gemela de
 * `PATCH /api/servicios/[id]/imagenes/[imagenId]`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { imagenId } = await params;
  const parsed = z
    .object({ mediaId: z.string().min(1) })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await reemplazarImagen(
        viewerFromMobileUser(userOrResponse),
        imagenId,
        parsed.data.mediaId
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

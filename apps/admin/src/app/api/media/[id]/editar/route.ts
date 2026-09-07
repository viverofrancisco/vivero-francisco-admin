import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { editarImagen } from "@/lib/services/media.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const schema = z.object({
  recorte: z
    .object({
      x: z.number().min(0),
      y: z.number().min(0),
      ancho: z.number().positive(),
      alto: z.number().positive(),
    })
    .optional(),
  redimensionar: z
    .object({ ancho: z.number().positive(), alto: z.number().positive() })
    .optional(),
  circulo: z.boolean().optional(),
});

/**
 * Recorta o redimensiona una imagen y devuelve **otra**.
 *
 * El original no se toca: la biblioteca es compartida, y recortar para un
 * producto no puede cambiarle la foto a la categoría que usa la misma.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({ media: await editarImagen(viewer, id, parsed.data) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

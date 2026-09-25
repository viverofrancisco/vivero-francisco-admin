import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { editarFotoDeVisita, editarImagen } from "@/lib/services/media.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { edicionDeImagenSchema } from "@/lib/validations/producto";

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
  const parsed = edicionDeImagenSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const { origen, ...edicion } = parsed.data;
    const media =
      origen === "visita"
        ? await editarFotoDeVisita(viewer, id, edicion)
        : await editarImagen(viewer, id, edicion);
    return NextResponse.json({ media });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

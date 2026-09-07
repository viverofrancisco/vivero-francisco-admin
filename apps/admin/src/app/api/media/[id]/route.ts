import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { actualizarMedia, borrarMedia } from "@/lib/services/media.service";
import { editarMediaSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** El nombre y el alt. Lo demás de un archivo no se edita. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = editarMediaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await actualizarMedia(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** La borra de la biblioteca y de R2. Solo si no la usa ningún producto. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await borrarMedia(viewer, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

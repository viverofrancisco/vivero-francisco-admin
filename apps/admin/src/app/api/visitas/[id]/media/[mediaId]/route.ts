import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  etiquetarVisitaMedia,
  removeVisitaMedia,
} from "@/lib/services/visita.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const etiquetaSchema = z.object({
  /** `null` la deja sin etiqueta, que es un estado válido. */
  productoId: z.string().min(1).nullable(),
});

/** Cambiar de qué producto es el archivo. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const viewer = await viewerFromSession();
  const { id, mediaId } = await params;
  const parsed = etiquetaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await etiquetarVisitaMedia(id, mediaId, parsed.data.productoId, viewer)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const viewer = await viewerFromSession();
  const { id, mediaId } = await params;
  try {
    await removeVisitaMedia(id, mediaId, viewer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

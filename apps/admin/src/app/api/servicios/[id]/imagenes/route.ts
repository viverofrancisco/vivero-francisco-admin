import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  agregarImagenes,
  listarImagenes,
  reordenarImagenes,
} from "@/lib/services/producto-imagen.service";
import {
  agregarImagenesSchema,
  reordenarImagenesSchema,
} from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Las fotos del producto, en orden. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json({ imagenes: await listarImagenes(viewer, id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Suma imágenes **de la biblioteca** al producto.
 *
 * Subir un archivo es otra cosa y vive en `/api/media`: acá solo se dice cuál
 * de las que ya existen usa este producto.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = agregarImagenesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await agregarImagenes(viewer, id, parsed.data.mediaIds),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Reordena: la primera es la que se muestra por defecto. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = reordenarImagenesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await reordenarImagenes(viewer, id, parsed.data.ids),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  actualizarCategoria,
  borrarCategoria,
} from "@/lib/services/categoria.service";
import { categoriaSchema } from "@/lib/validations/categoria";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = categoriaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await actualizarCategoria(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await borrarCategoria(viewer, id);
    return NextResponse.json({ message: "Categoría eliminada" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

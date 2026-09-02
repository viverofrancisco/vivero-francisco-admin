import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { actualizarEmisor, borrarEmisor } from "@/lib/services/emisor.service";
import { emisorSchema } from "@/lib/validations/emisor";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = emisorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await actualizarEmisor(viewer, id, parsed.data));
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
    await borrarEmisor(viewer, id);
    return NextResponse.json({ message: "Emisor eliminado" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

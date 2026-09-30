import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { actualizarEmisor, borrarEmisor } from "@/lib/services/emisor.service";
import { emisorSchema } from "@/lib/validations/emisor";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = emisorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(await actualizarEmisor(viewerFromMobileUser(u), id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const { id } = await params;
  try {
    await borrarEmisor(viewerFromMobileUser(u), id);
    return NextResponse.json({ message: "Emisor eliminado" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

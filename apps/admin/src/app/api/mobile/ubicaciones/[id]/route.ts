import { NextResponse } from "next/server";
import { ubicacionSchema } from "@vivero/shared";
import { isMobileUser, requireMobileRole } from "@/lib/mobile/auth";
import {
  actualizarUbicacion,
  eliminarUbicacion,
  getUbicacion,
} from "@/lib/services/ubicacion.service";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const u = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(u)) return u;
  const viewer = viewerFromMobileUser(u);
  const { id } = await params;
  try {
    return NextResponse.json(await getUbicacion(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Cambia lo que venga: el nombre y la dirección, o solo activarla o el retiro. */
export async function PUT(request: Request, { params }: Ctx) {
  const u = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(u)) return u;
  const viewer = viewerFromMobileUser(u);
  const { id } = await params;
  const parsed = ubicacionSchema.partial().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await actualizarUbicacion(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const u = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(u)) return u;
  const viewer = viewerFromMobileUser(u);
  const { id } = await params;
  try {
    await eliminarUbicacion(viewer, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

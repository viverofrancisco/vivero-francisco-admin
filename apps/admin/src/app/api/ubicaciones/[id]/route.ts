import { NextResponse } from "next/server";
import { ubicacionSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  actualizarUbicacion,
  eliminarUbicacion,
  getUbicacion,
} from "@/lib/services/ubicacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await getUbicacion(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Cambia lo que venga: el nombre y la dirección, o solo activarla o el retiro. */
export async function PUT(request: Request, { params }: Ctx) {
  const viewer = await viewerFromSession();
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

export async function DELETE(_request: Request, { params }: Ctx) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await eliminarUbicacion(viewer, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

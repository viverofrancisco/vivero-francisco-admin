import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly, viewerFromSession } from "@/lib/auth-helpers";
import { propiedadSchema } from "@/lib/validations/cliente";
import {
  actualizarPropiedad,
  eliminarPropiedad,
} from "@/lib/services/propiedad.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string; propiedadId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = propiedadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id, propiedadId } = await params;
  try {
    const propiedad = await actualizarPropiedad(
      await viewerFromSession(),
      id,
      propiedadId,
      parsed.data
    );
    return NextResponse.json(propiedad);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id, propiedadId } = await params;
  try {
    await eliminarPropiedad(await viewerFromSession(), id, propiedadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

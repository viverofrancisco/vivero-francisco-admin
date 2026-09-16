import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly, viewerFromSession } from "@/lib/auth-helpers";
import { propiedadSchema } from "@/lib/validations/cliente";
import { crearPropiedad } from "@/lib/services/propiedad.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Agregar una propiedad a un cliente. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  try {
    const propiedad = await crearPropiedad(
      await viewerFromSession(),
      id,
      parsed.data
    );
    return NextResponse.json(propiedad, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

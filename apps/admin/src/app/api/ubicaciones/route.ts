import { NextResponse } from "next/server";
import { ubicacionSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { crearUbicacion, listUbicaciones } from "@/lib/services/ubicacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Las ubicaciones del vivero (*Configuración → Ubicaciones*). */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const estado = new URL(request.url).searchParams.get("estado");
  try {
    return NextResponse.json(
      await listUbicaciones(viewer, {
        estado: estado === "activas" || estado === "inactivas" ? estado : undefined,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = ubicacionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearUbicacion(viewer, parsed.data), { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

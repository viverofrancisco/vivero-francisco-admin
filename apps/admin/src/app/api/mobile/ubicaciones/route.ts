import { NextResponse } from "next/server";
import { ubicacionSchema } from "@vivero/shared";
import { isMobileUser, requireMobileRole } from "@/lib/mobile/auth";
import { crearUbicacion, listUbicaciones } from "@/lib/services/ubicacion.service";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";

/** La gemela de `/api/ubicaciones`, para *Más → Ubicaciones* en la app. */
export async function GET(request: Request) {
  const u = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(u)) return u;
  const viewer = viewerFromMobileUser(u);
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
  const u = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(u)) return u;
  const viewer = viewerFromMobileUser(u);
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

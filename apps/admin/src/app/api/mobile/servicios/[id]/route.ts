import { NextResponse } from "next/server";
import { updateServicioSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  getServicio,
  updateServicio,
} from "@/lib/services/servicio.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  try {
    const servicio = await getServicio(
      id,
      viewerFromMobileUser(userOrResponse)
    );
    // `suscripciones` y no `_count.suscripcionItems`: la lista ya lo manda
    // así, y dos nombres para el mismo número obligan a recordar en cuál de
    // las dos pantallas se está.
    const { _count, ...resto } = servicio;
    return NextResponse.json({
      ...resto,
      createdAt: servicio.createdAt.toISOString(),
      suscripciones: _count.suscripcionItems,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = updateServicioSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const servicio = await updateServicio(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(servicio);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

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
    "STAFF",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  try {
    const servicio = await getServicio(
      id,
      viewerFromMobileUser(userOrResponse)
    );
    return NextResponse.json(servicio);
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

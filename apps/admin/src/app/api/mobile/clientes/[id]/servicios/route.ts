import { NextResponse } from "next/server";
import { asignarServicioSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { asignarServicioToCliente } from "@/lib/services/cliente.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = asignarServicioSchema.safeParse(
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
    const cs = await asignarServicioToCliente(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(cs, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

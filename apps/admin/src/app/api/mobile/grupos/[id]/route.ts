import { NextResponse } from "next/server";
import { grupoSchema } from "@/lib/validations/grupo";
import { requireMobileUser, requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  actualizarGrupo,
  archivarGrupo,
  getGrupo,
} from "@/lib/services/grupo.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    return NextResponse.json(
      await getGrupo(viewerFromMobileUser(userOrResponse), id)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = grupoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await actualizarGrupo(viewerFromMobileUser(userOrResponse), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    await archivarGrupo(viewerFromMobileUser(userOrResponse), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

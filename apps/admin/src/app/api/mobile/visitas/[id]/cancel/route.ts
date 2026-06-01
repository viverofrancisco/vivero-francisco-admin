import { NextResponse } from "next/server";
import { cancelVisitaSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { cancelVisita } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = cancelVisitaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const visita = await cancelVisita(
      id,
      viewerFromMobileUser(userOrResponse),
      { motivo: parsed.data.motivo }
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

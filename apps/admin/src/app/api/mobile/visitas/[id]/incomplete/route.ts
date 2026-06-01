import { NextResponse } from "next/server";
import { incompleteVisitaSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { markVisitaIncomplete } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // STAFF is intentionally read-only on mobile (per the v1 plan).
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = incompleteVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Motivo requerido" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const visita = await markVisitaIncomplete(
      id,
      viewerFromMobileUser(userOrResponse),
      {
        reason: parsed.data.reason,
        fechaRealizada: parsed.data.fechaRealizada
          ? new Date(parsed.data.fechaRealizada)
          : undefined,
        horaEntrada: parsed.data.horaEntrada,
        horaSalida: parsed.data.horaSalida,
        media: parsed.data.media,
      }
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { noRealizadaVisitaSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { markVisitaNoRealizada } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Cerrarla como no realizada: la cuadrilla fue y no hubo trabajo. De oficina,
 * como completarla; el gemelo de `/complete` e `/incomplete`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = noRealizadaVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const visita = await markVisitaNoRealizada(
      id,
      viewerFromMobileUser(userOrResponse),
      {
        motivo: parsed.data.motivo,
        nota: parsed.data.nota,
        notas: parsed.data.notas,
        fechaRealizada: parsed.data.fechaRealizada
          ? new Date(parsed.data.fechaRealizada)
          : undefined,
        reprogramarPara: parsed.data.reprogramarPara
          ? new Date(`${parsed.data.reprogramarPara}T00:00:00.000Z`)
          : null,
      }
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

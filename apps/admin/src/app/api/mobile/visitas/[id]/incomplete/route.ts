import { NextResponse } from "next/server";
import { incompleteVisitaSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { markVisitaIncomplete } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Cerrarla diciendo que quedó a medias. De oficina, como completarla. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = incompleteVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const visita = await markVisitaIncomplete(
      id,
      viewerFromMobileUser(userOrResponse),
      {
        motivo: parsed.data.motivo,
        notas: parsed.data.notas,
        fechaRealizada: parsed.data.fechaRealizada
          ? new Date(parsed.data.fechaRealizada)
          : undefined,
      }
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

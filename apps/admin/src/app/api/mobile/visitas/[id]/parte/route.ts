import { NextResponse } from "next/server";
import { parteVisitaSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { registrarParte } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * "Esto hice yo": las horas y las tareas de quien manda el pedido.
 *
 * Sin filtro de rol acá: `registrarParte` decide quién puede y sobre quién —un
 * jardinero solo sobre sí mismo y solo en una visita donde esté asignado, la
 * oficina sobre cualquiera para corregir—. Repetir la regla en la ruta es tener
 * dos lugares donde se puede desincronizar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = parteVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const visita = await registrarParte(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

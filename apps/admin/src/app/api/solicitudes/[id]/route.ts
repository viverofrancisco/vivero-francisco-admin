import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, viewerFromUser } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { marcarSolicitudAtendida } from "@/lib/services/solicitud.service";

const schema = z.object({ atendida: z.boolean() });

/** Marcar atendida una solicitud de cliente, o devolverla a pendiente. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await marcarSolicitudAtendida(viewerFromUser(actor), id, parsed.data.atendida)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

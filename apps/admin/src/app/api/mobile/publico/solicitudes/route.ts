import { NextResponse } from "next/server";
import { solicitudDeInvitadoSchema } from "@vivero/shared";
import { enforceSolicitudInvitadoLimit } from "@/lib/mobile/rate-limit";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearSolicitudDeInvitado } from "@/lib/services/solicitud.service";

/**
 * Pedir una visita o una cotización **sin cuenta**, desde el modo invitado.
 * Trae nombre y teléfono, que es como el vivero contesta.
 */
export async function POST(request: Request) {
  const parsed = solicitudDeInvitadoSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await enforceSolicitudInvitadoLimit(ip);
  if (limite) {
    return NextResponse.json(
      { error: limite.reason, retryAfter: limite.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    );
  }

  try {
    return NextResponse.json(await crearSolicitudDeInvitado(parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

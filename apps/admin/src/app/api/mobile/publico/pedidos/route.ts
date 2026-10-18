import { NextResponse } from "next/server";
import { pedidoInvitadoSchema } from "@vivero/shared";
import { enforcePedidoInvitadoLimit } from "@/lib/mobile/rate-limit";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearPedidoDeInvitado } from "@/lib/services/pedido-app.service";

/**
 * El checkout **sin cuenta**, desde el modo invitado: el carrito más nombre,
 * teléfono y correo. Crea su ficha y el pedido en borrador con el stock
 * apartado, y avisa al equipo. Ver `crearPedidoDeInvitado`.
 */
export async function POST(request: Request) {
  const parsed = pedidoInvitadoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await enforcePedidoInvitadoLimit(ip);
  if (limite) {
    return NextResponse.json(
      { error: limite.reason, retryAfter: limite.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    );
  }

  try {
    return NextResponse.json(await crearPedidoDeInvitado(parsed.data), { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

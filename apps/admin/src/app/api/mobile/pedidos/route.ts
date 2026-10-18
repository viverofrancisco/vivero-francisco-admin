import { NextResponse } from "next/server";
import { pedidoSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  crearPedidoDesdeLaApp,
  listarPedidosDelCliente,
} from "@/lib/services/pedido-app.service";

/** Sus pedidos, para la pestaña Pedidos. */
export async function GET(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }
  try {
    return NextResponse.json({ items: await listarPedidosDelCliente(user.clienteId) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * El cliente confirma su carrito: queda un pedido en borrador, con el stock
 * apartado, y se avisa al equipo. Ver `pedido-app.service.ts`.
 */
export async function POST(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }

  const parsed = pedidoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const pedido = await crearPedidoDesdeLaApp(
      { userId: user.id, clienteId: user.clienteId },
      parsed.data
    );
    return NextResponse.json(pedido, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

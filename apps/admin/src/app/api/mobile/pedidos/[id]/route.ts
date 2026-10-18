import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { pedidoDelCliente } from "@/lib/services/pedido-app.service";

/** Uno de sus pedidos, con sus líneas y cómo se entrega. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await pedidoDelCliente(user.clienteId, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

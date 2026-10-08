import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { eliminarCuentaDeCliente } from "@/lib/services/registro-cliente.service";

/**
 * Eliminar la propia cuenta. Solo el cliente: la del equipo la abre y la
 * cierra el vivero, y su nombre firma visitas e informes.
 */
export async function DELETE(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }

  try {
    const res = await eliminarCuentaDeCliente(user.id, user.clienteId);
    return NextResponse.json({ ok: true, ...res });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

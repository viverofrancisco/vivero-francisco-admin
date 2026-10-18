import { NextResponse } from "next/server";
import { isMobileUser, requireMobileRole } from "@/lib/mobile/auth";
import { ubicacionesDeRetiro } from "@/lib/services/ubicacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Dónde puede retirar el cliente su pedido: las ubicaciones activas con retiro. */
export async function GET(request: Request) {
  const u = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(u)) return u;
  try {
    return NextResponse.json({ ubicaciones: await ubicacionesDeRetiro() });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

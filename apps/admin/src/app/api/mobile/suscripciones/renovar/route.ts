import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { generarRenovaciones } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Dispara desde el teléfono la generación de renovaciones de **todos** los
 * planes: la misma función que corre el cron, igual de idempotente. Existe
 * para ponerse al día sin esperar al día siguiente cuando el cron falló.
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const r = await generarRenovaciones();
    return NextResponse.json({ creadas: r.creadas.length });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { generarRenovaciones } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Genera a mano los borradores de los períodos vencidos de **este** plan,
 * desde el teléfono. Lo mismo que hace el cron cada noche; es idempotente, así
 * que apretarlo de más no duplica nada.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  try {
    const r = await generarRenovaciones(new Date(), id);
    return NextResponse.json({ creadas: r.creadas.length });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

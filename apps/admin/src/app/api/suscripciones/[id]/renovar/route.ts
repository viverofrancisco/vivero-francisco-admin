import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { generarRenovaciones } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Genera a mano los borradores de los períodos vencidos de **esta** suscripción.
 *
 * Lo mismo que hace el cron todas las noches, acotado a una. Existe para cuando
 * el cron falló o alguien no quiere esperar hasta mañana; es idempotente, así
 * que apretarlo de más no duplica nada.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  try {
    const r = await generarRenovaciones(new Date(), id);
    return NextResponse.json({
      creadas: r.creadas.length,
      omitidas: r.omitidas,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

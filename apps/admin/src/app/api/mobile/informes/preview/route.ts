import { NextResponse } from "next/server";
import { informePreviewSchema } from "@/lib/validations/informe";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { subirVistaPreviaDelInforme } from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La vista previa del informe desde la app: el PDF tal como saldría, sin
 * guardar nada en la base. Mismo cuerpo que el POST que lo genera, a
 * propósito. La ruta del portal devuelve los bytes; esta devuelve una URL en
 * R2, porque el visor del teléfono no puede mandar el token.
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = informePreviewSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const { borrador, ...payload } = parsed.data;
    return NextResponse.json(
      await subirVistaPreviaDelInforme(
        viewerFromMobileUser(userOrResponse),
        payload,
        { borrador }
      )
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

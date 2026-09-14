import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { listTareas } from "@/lib/services/tarea.service";

/**
 * El catálogo, para las casillas que el jardinero marca al cerrar una visita.
 *
 * Sin filtrar por rol acá: `listTareas` ya decide quién puede leerlo —el
 * personal sí, el cliente no— y repetir la regla en la ruta es tener dos
 * lugares donde se puede desincronizar.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const items = await listTareas(viewerFromMobileUser(userOrResponse));
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

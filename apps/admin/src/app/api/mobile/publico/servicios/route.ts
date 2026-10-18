import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { serviciosParaSolicitar } from "@/lib/services/solicitud.service";

/**
 * Los servicios que se pueden marcar al pedir una visita, **sin sesión**: el
 * invitado también los elige. Solo nombre y descripción de los activos, lo
 * mismo que mostraba el catálogo antes de quedarse con los bienes.
 */
export async function GET() {
  try {
    return NextResponse.json({ items: await serviciosParaSolicitar() });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

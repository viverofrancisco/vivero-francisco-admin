import { NextResponse } from "next/server";
import { calificacionVisitaSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import {
  getCalificacion,
  guardarCalificacion,
} from "@/lib/services/calificacion.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** La calificación de esta visita, o `null`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  try {
    const calificacion = await getCalificacion(
      id,
      viewerFromMobileUser(userOrResponse)
    );
    return NextResponse.json({ calificacion });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * El cliente califica, o cambia lo que había puesto.
 *
 * Sin filtro de rol acá: el servicio decide: solo el dueño de la visita, y solo
 * si está completada. Repetir la regla en la ruta es tener dos lugares donde se
 * puede desincronizar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = calificacionVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const calificacion = await guardarCalificacion(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json({ calificacion });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

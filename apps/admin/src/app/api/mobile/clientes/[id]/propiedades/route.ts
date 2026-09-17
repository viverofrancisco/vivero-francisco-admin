import { NextResponse } from "next/server";
import { createPropiedadSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { crearPropiedad } from "@/lib/services/propiedad.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Agregarle una propiedad a un cliente, desde el teléfono.
 *
 * Existía solo en el portal, así que quien cargaba un cliente desde la app le
 * dejaba la "Principal" y ahí se terminaba: la segunda casa había que cargarla
 * después, sentado. Y la app es justo donde se está parado en la puerta de la
 * segunda casa.
 *
 * La autorización la decide el servicio (`ensureOficina`), igual que en el
 * portal; el rol acá es el portero de la ruta.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createPropiedadSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const propiedad = await crearPropiedad(
      viewerFromMobileUser(userOrResponse),
      id,
      parsed.data
    );
    return NextResponse.json(propiedad, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

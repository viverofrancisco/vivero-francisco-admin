import { NextResponse } from "next/server";
import { novedadVisitaSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { reportarNovedad } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * "Llegué y no pude hacer la visita." **Solo desde la app**, como las marcas:
 * viaja con la ubicación y el aparato, y eso vale lo que vale la lectura del
 * teléfono, no la de un navegador donde se falsea en tres clics.
 *
 * El instante lo pone el servidor, salvo que se haya reportado **sin señal**:
 * ahí viaja la hora del teléfono (`marcadaEl`) y un reintento con la misma
 * hora es la misma novedad, no otra.
 *
 * Sin filtro de rol acá: el servicio decide quién puede.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = novedadVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  const datos = parsed.data;
  try {
    const visita = await reportarNovedad(id, viewerFromMobileUser(userOrResponse), {
      motivo: datos.motivo,
      nota: datos.nota,
      fotos: datos.fotos ?? [],
      ubicacion: datos.ubicacion ?? undefined,
      dispositivo: datos.dispositivo,
      marcadaEl: datos.marcadaEl,
      sinConexion: datos.sinConexion,
    });
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

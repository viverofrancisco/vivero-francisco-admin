import { NextResponse } from "next/server";
import { marcaVisitaSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { marcarEntrada, marcarSalida } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Marcar entrada o salida. **Esta es la única ruta que marca.**
 *
 * La del portal web se fue: ahí la ubicación se falsea en tres clics con las
 * DevTools, así que una marca hecha desde el navegador no dice nada que no diga
 * escribir la hora a mano, y encima parece que sí. Acá el permiso se pide en
 * serio y Android delata las de mock.
 *
 * El instante lo pone el servidor, no el cliente: una hora que manda el
 * teléfono es una hora que el teléfono elige. Lo que sí viaja es dónde estaba,
 * y eso puede faltar — ver `marcarEntrada` para por qué se registra igual.
 *
 * Sin filtro de rol acá: el servicio decide quién puede. Repetir la regla en la
 * ruta es tener dos lugares donde se puede desincronizar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = marcaVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  const viewer = viewerFromMobileUser(userOrResponse);
  const datos = parsed.data;
  try {
    const visita =
      datos.tipo === "ENTRADA"
        ? await marcarEntrada(id, viewer, {
            ubicacion: datos.ubicacion ?? undefined,
            dispositivo: datos.dispositivo,
          })
        : await marcarSalida(id, viewer, {
            ubicacion: datos.ubicacion ?? undefined,
            dispositivo: datos.dispositivo,
            tareaIds: datos.tareaIds,
            media: datos.media,
          });
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

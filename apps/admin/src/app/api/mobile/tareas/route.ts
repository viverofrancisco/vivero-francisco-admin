import { NextResponse } from "next/server";
import {
  requireMobileUser,
  requireMobileRole,
  isMobileUser,
} from "@/lib/mobile/auth";
import { tareaSchema } from "@/lib/validations/tarea";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import {
  createTarea,
  getOrdenTareas,
  listTareas,
} from "@/lib/services/tarea.service";

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
    // El modo viaja con la lista: la pantalla necesita saber si lo que está
    // viendo es el acomodo a mano o un alfabético, y pedirlo aparte sería un
    // viaje más para un dato que siempre se usa junto con las tareas.
    const [items, orden] = await Promise.all([
      listTareas(viewerFromMobileUser(userOrResponse)),
      getOrdenTareas(),
    ]);
    return NextResponse.json({ items, orden });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Crear una tarea. Va al final de la lista: reordenar es otra cosa, y se hace
 *  en el portal, arrastrando —que es un gesto de escritorio—. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = tareaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const tarea = await createTarea(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(tarea, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { setOrdenTareas } from "@/lib/services/tarea.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Cómo se ordena el catálogo de tareas. **Es una configuración, no una vista.**
 *
 * Vive en `EmpresaConfig` y manda en las dos pantallas: ordenar A–Z acá cambia
 * también las casillas que el jardinero marca al cerrar una visita. Si fuera
 * una preferencia de pantalla, la oficina vería una cosa y el teléfono otra.
 *
 * Elegir el modo **sí se guarda al tocarlo**: es una sola decisión y no hay
 * nada que confirmar. Lo que espera al botón de guardar es el acomodo a mano
 * —ver `/reordenar`—, que son diecisiete movimientos y uno querría poder
 * arrepentirse.
 */
const ordenSchema = z.object({
  modo: z.enum(["PERSONALIZADO", "ALFABETICO_AZ", "ALFABETICO_ZA"]),
});

export async function PUT(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = ordenSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    await setOrdenTareas(viewerFromMobileUser(userOrResponse), parsed.data.modo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

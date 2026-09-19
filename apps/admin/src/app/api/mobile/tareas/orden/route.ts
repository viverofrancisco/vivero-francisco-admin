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
 * Elegir el modo **no se guarda al tocarlo**: la pantalla lo deja pendiente
 * junto con el acomodo a mano —ver `/reordenar`— y confirma las dos cosas con
 * un solo *Guardar*. Es lo mismo que cambia todo el sistema, así que se decide
 * igual que se acomodan diecisiete filas: con manera de arrepentirse.
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

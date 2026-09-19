import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { reordenarTareas } from "@/lib/services/tarea.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * El acomodo a mano: se manda **la lista entera**, no "subí esta una".
 *
 * Con dos pantallas moviendo al mismo tiempo, "subí esta" deja dos tareas en el
 * mismo lugar; mandando toda la lista, la última en guardar define un orden
 * completo y coherente. Viaja además el modo —por omisión PERSONALIZADO, que es
 * lo que quiso quien movió las filas—, así acomodar y elegir cómo se ve la
 * lista se guardan juntos o no se guarda ninguno. Ver `reordenarTareas`.
 */
const reordenarSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  /**
   * Con qué modo queda la lista. Viaja acá porque en la pantalla es una sola
   * decisión —acomodar y elegir cómo se ve— y se confirma de una.
   */
  modo: z.enum(["PERSONALIZADO", "ALFABETICO_AZ", "ALFABETICO_ZA"]).optional(),
});

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = reordenarSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    await reordenarTareas(viewerFromMobileUser(userOrResponse), parsed.data.ids, parsed.data.modo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

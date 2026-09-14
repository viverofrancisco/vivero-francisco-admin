import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { reordenarTareas } from "@/lib/services/tarea.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Se manda la lista entera, no "subí esta una". Ver `reordenarTareas`.
 */
const reordenarSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = reordenarSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    await reordenarTareas(viewer, parsed.data.ids);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

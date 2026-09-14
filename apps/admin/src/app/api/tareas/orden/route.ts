import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { setOrdenTareas } from "@/lib/services/tarea.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const ordenSchema = z.object({
  modo: z.enum(["PERSONALIZADO", "ALFABETICO_AZ", "ALFABETICO_ZA"]),
});

export async function PUT(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = ordenSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    await setOrdenTareas(viewer, parsed.data.modo);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

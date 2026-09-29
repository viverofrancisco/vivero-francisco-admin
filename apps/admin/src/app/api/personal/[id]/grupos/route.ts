import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { setGruposDePersonal } from "@/lib/services/grupo.service";

const bodySchema = z.object({ grupoIds: z.array(z.string().min(1)).max(100) });

/**
 * En qué cuadrillas está esta persona, desde su ficha. Gemela de la ruta
 * móvil; el servicio es el mismo y decide quién puede.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json({
      grupos: await setGruposDePersonal(viewer, id, parsed.data.grupoIds),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

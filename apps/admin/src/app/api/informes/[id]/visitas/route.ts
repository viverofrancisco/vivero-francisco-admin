import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { actualizarVisitasDelInforme } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** El conjunto entero, no un alta: lo que llega es el estado final. */
const schema = z.object({ visitaIds: z.array(z.string().min(1)) });

/**
 * Cambia qué visitas cubre un informe ya generado.
 *
 * No contradice que el informe sea inmutable: lo que no se toca es el
 * documento —título, secciones, fotos y el PDF que el cliente ya tiene—. Las
 * visitas no salen impresas, son el vínculo con el trabajo que cuenta, y ese
 * vínculo se corrige.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await actualizarVisitasDelInforme(viewer, id, parsed.data.visitaIds)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

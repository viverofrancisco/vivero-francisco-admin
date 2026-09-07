import { NextResponse } from "next/server";
import { informePreviewSchema } from "@/lib/validations/informe";
import { viewerFromSession } from "@/lib/auth-helpers";
import { previsualizarInforme } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El PDF tal como saldría, sin guardar nada.
 *
 * Mismo cuerpo que el POST que genera el informe —a propósito: si la vista
 * previa aceptara otra cosa, mostraría un documento distinto del que se va a
 * archivar—. No escribe en R2 ni en la base, así que no consume numeración ni
 * deja nada que limpiar si nadie confirma.
 */
export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = informePreviewSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const { borrador, ...payload } = parsed.data;
    const pdf = await previsualizarInforme(viewer, payload, { borrador });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // `inline` para que el navegador lo abra en una pestaña en vez de
        // bajarlo: mirar y volver a ajustar es el punto de la vista previa.
        "Content-Disposition": 'inline; filename="vista-previa.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

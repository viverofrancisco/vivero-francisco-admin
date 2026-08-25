import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { anularOrdenCompleta } from "@/lib/services/factura.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Anula la orden y su factura.
 *
 * `liberarTrabajo` es el sí explícito a soltar las visitas y los períodos que
 * la orden tenía reservados. Sin él, una orden con trabajo enlazado no se
 * anula: el servicio responde 409 con cuántas líneas hay que desenlazar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  // Sin cuerpo es el caso normal (una orden sin trabajo enlazado).
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(
      await anularOrdenCompleta(viewer, id, {
        liberarTrabajo: body?.liberarTrabajo === true,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  contarStock,
  moverStock,
  movimientosDeVariante,
} from "@/lib/services/inventario.service";
import { movimientoSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** El libro de la variante, lo último primero. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json({
      movimientos: await movimientosDeVariante(viewer, id),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Mueve el stock.
 *
 * `CONTEO` manda **cuánto hay** y el servicio calcula la diferencia; los otros
 * mandan **cuánto se movió**. Son dos preguntas distintas: quien cuenta el
 * estante no sabe cuánto decía el sistema, y hacérselo restar a mano es pedirle
 * la única cuenta que la máquina no puede errar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = movimientoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const d = parsed.data;
    const movimiento =
      d.motivo === "CONTEO"
        ? await contarStock(viewer, id, d.contado, d.nota)
        : await moverStock(viewer, id, {
            cantidad: d.motivo === "INGRESO" ? Math.abs(d.cantidad) : d.cantidad,
            motivo: d.motivo,
            nota: d.nota,
          });
    return NextResponse.json({ movimiento });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

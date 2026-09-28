import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { contarStock, moverStock } from "@/lib/services/inventario.service";
import { movimientoSchema } from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La gemela de `POST /api/variantes/[id]/movimientos`: mueve el stock por
 * el libro. `CONTEO` manda **cuánto hay** y el servicio calcula la
 * diferencia; `INGRESO` y `AJUSTE` mandan **cuánto se movió**.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  const parsed = movimientoSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const viewer = viewerFromMobileUser(userOrResponse);
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

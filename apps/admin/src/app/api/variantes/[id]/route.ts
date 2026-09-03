import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { actualizarVariante } from "@/lib/services/variante.service";
import { varianteSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Los datos propios de una variante: su SKU, si se cuenta, si se puede vender
 * sin stock, y cuál de las fotos del producto la representa.
 *
 * **El stock no está acá.** Se mueve por el libro (`/movimientos`), nunca
 * escribiéndole encima: un número que cambia sin dejar rastro no se puede
 * discutir después.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = varianteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await actualizarVariante(viewer, id, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

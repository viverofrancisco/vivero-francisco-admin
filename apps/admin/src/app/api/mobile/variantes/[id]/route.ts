import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { actualizarVariante } from "@/lib/services/variante.service";
import { varianteSchema } from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La gemela de `PATCH /api/variantes/[id]`: los datos propios de una
 * variante —SKU, precio, costo, peso, si se cuenta, si se vende sin stock—
 * por el mismo servicio y con el mismo schema. **El stock no está acá**: se
 * mueve por el libro (`/movimientos`), nunca escribiéndole encima.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  const parsed = varianteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const variante = await actualizarVariante(
      viewerFromMobileUser(userOrResponse),
      id,
      parsed.data
    );
    return NextResponse.json({ id: variante.id });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

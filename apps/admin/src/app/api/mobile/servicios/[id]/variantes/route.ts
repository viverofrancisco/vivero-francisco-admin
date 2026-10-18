import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { editarVariantesEnLote } from "@/lib/services/variante.service";
import { variantesEnLoteSchema } from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * *Editar en lote* desde la app: varias variantes del producto a la vez, cada
 * una con su valor. Responde cuántas quedaron y cuáles no, con su motivo
 * (`editarVariantesEnLote`). El portal guarda lo mismo desde su barra.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  const parsed = variantesEnLoteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await editarVariantesEnLote(
        viewerFromMobileUser(userOrResponse),
        id,
        parsed.data.cambios
      )
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

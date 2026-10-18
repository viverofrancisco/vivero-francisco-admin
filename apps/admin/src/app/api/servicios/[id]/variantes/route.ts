import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { editarVariantesEnLote } from "@/lib/services/variante.service";
import { variantesEnLoteSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * *Editar en lote* las variantes de un producto: la gemela de
 * `PATCH /api/mobile/servicios/[id]/variantes`, para la ficha del portal en el
 * teléfono, que guarda en el acto como la app. El escritorio deja los cambios
 * pendientes y los guarda con la barra.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = variantesEnLoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await editarVariantesEnLote(viewer, id, parsed.data.cambios));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

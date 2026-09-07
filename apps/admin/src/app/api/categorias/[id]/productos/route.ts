import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { fijarProductos } from "@/lib/services/categoria.service";
import { agregarProductosSchema } from "@/lib/validations/categoria";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Deja la categoría con **exactamente** estos productos.
 *
 * Un reemplazo y no un alta suelta: lo que llega es el estado final, igual que
 * las líneas de una orden, porque es lo que se guarda desde la ficha.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = agregarProductosSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await fijarProductos(viewer, id, parsed.data.productoIds)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

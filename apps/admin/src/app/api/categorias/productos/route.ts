import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { productosParaElegir } from "@/lib/services/categoria.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El catálogo para elegir productos de una categoría. `?q=` busca por nombre,
 * `?offset=` continúa la lista.
 *
 * Sin filtrar por categoría: sirve igual sobre una que existe y sobre una que
 * se está creando, y quién ya está elegido lo sabe la pantalla.
 */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const params = new URL(request.url).searchParams;
  try {
    const { items, hayMas } = await productosParaElegir(viewer, {
      search: params.get("q") ?? undefined,
      offset: Number(params.get("offset")) || 0,
      limit: Number(params.get("limit")) || 20,
    });
    return NextResponse.json({ productos: items, hayMas });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

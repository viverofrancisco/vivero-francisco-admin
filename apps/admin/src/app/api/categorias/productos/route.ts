import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { productosParaElegir } from "@/lib/services/categoria.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El catálogo para elegir productos de una categoría. `?q=` busca por nombre.
 *
 * Sin filtrar por categoría: sirve igual sobre una que existe y sobre una que
 * se está creando, y quién ya está elegido lo sabe la pantalla.
 */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({ productos: await productosParaElegir(viewer, q) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

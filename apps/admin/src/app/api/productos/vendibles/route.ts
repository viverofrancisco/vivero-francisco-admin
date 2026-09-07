import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth-helpers";
import { productosVendibles } from "@/lib/services/variantes-vendibles";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El catálogo vendible, de a tandas. `?q=` busca por nombre, `?offset=` sigue.
 *
 * Lo usa el selector de productos de una orden mientras se escribe o se baja
 * la lista, para no traer el catálogo entero al abrir la pantalla.
 */
export async function GET(request: Request) {
  // Órdenes es cosa de ADMIN/STAFF, igual que las pantallas que lo consultan.
  await requireStaff();
  const params = new URL(request.url).searchParams;
  try {
    const { items, hayMas } = await productosVendibles({
      search: params.get("q") ?? undefined,
      offset: Number(params.get("offset")) || 0,
      limit: Number(params.get("limit")) || 20,
    });
    return NextResponse.json({ productos: items, hayMas });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

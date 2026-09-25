import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { productosVendibles } from "@/lib/services/variantes-vendibles";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * El catálogo para armar una orden desde el teléfono, con sus variantes y
 * precios de lista, de a tandas. Es la misma consulta que usa el portal.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const params = new URL(request.url).searchParams;
  try {
    const { items, hayMas } = await productosVendibles({
      search: params.get("q") ?? undefined,
      offset: Number(params.get("offset")) || 0,
      limit: Number(params.get("limit")) || 20,
    });
    return NextResponse.json({ items, hayMas });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { productoDelCatalogo } from "@/lib/services/catalogo.service";

/** La ficha de un producto, sin sesión. Ver `../route.ts`. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return NextResponse.json(await productoDelCatalogo(id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

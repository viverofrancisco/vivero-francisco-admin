import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { productoDelCatalogo } from "@/lib/services/catalogo.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireMobileUser(request);
  if (!isMobileUser(user)) return user;
  const { id } = await params;
  try {
    return NextResponse.json(await productoDelCatalogo(id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

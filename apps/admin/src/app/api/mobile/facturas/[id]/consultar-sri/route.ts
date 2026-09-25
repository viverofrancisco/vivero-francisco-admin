import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { consultarFacturaAlSri } from "@/lib/services/factura.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Le pregunta al SRI por una factura sin resolver, desde el teléfono. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    return NextResponse.json(
      await consultarFacturaAlSri(viewerFromMobileUser(userOrResponse), id)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

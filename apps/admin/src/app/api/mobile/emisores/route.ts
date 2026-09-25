import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { emisoresParaEmitir } from "@/lib/services/emisor.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Con qué RUC se puede emitir desde el teléfono: lo justo para elegir uno. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const items = await emisoresParaEmitir(viewerFromMobileUser(userOrResponse));
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

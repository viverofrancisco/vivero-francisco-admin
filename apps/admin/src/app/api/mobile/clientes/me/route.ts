import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { getClienteProfile } from "@/lib/services/cliente.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  try {
    const data = await getClienteProfile(viewerFromMobileUser(userOrResponse));
    return NextResponse.json(data);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

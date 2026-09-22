import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { miembrosPosibles } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** A quién se puede meter en un chat. Solo ADMIN: lo decide el servicio. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    return NextResponse.json({
      items: await miembrosPosibles(viewerFromMobileUser(userOrResponse)),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

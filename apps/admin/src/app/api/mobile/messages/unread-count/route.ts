import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { totalUnreadForViewer } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  try {
    const count = await totalUnreadForViewer(
      viewerFromMobileUser(userOrResponse)
    );
    return NextResponse.json({ count });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

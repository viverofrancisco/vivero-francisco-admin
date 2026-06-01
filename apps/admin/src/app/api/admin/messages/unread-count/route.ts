import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { totalUnreadForViewer } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    const count = await totalUnreadForViewer(viewer);
    return NextResponse.json({ count });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

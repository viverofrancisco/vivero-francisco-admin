import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listInbox } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(url.searchParams.get("limit") ?? 30) || 30;
  try {
    const result = await listInbox(viewer, { offset, limit });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

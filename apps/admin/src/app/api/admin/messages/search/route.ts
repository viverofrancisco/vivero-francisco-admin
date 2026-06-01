import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { searchInbox } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(url.searchParams.get("limit") ?? 20) || 20;
  try {
    const result = await searchInbox(viewer, { q, offset, limit });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

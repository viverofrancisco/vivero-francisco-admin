import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { globalSearch } from "@/lib/services/search.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 5) || 5;
  try {
    const result = await globalSearch(viewer, q, limit);
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

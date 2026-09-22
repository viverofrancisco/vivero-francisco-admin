import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { miembrosPosibles } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** A quién se puede meter en un chat. Solo ADMIN. */
export async function GET() {
  try {
    return NextResponse.json({
      items: await miembrosPosibles(await viewerFromSession()),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { infoDeMensaje } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Quién leyó un mensaje propio, y cuándo. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return NextResponse.json(await infoDeMensaje(await viewerFromSession(), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

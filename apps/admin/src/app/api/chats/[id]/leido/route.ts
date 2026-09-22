import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { marcarLeido } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Abrí el chat: hasta acá leí. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await marcarLeido(await viewerFromSession(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

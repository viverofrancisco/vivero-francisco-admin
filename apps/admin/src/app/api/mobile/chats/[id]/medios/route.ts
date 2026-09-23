import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { mediosDelChatQuerySchema } from "@vivero/shared";
import { mediosDelChat } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Las fotos y videos, o los enlaces, de un chat. Del más nuevo al más viejo. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const parsed = mediosDelChatQuerySchema.safeParse({
    tipo: searchParams.get("tipo") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await mediosDelChat(viewerFromMobileUser(userOrResponse), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { sendChatMessageSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listMessages, sendMessage } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const { id } = await params;
  try {
    const result = await listMessages(id, viewer, { cursor, limit: 200 });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const parsed = sendChatMessageSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const message = await sendMessage(id, viewer, {
      body: parsed.data.body,
      media: parsed.data.media,
    });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

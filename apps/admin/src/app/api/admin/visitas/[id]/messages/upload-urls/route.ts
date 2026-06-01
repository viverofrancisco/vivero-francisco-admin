import { NextResponse } from "next/server";
import { chatUploadUrlsSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { requestChatMediaUploads } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const parsed = chatUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const uploads = await requestChatMediaUploads(id, viewer, parsed.data.files);
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

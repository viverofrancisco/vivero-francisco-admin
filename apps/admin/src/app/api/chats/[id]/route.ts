import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { actualizarChatSchema } from "@vivero/shared";
import {
  archivarChat,
  getChat,
  updateChat,
} from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await getChat(await viewerFromSession(), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Renombrar o cambiar quién está adentro. Solo ADMIN. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const parsed = actualizarChatSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    await updateChat(await viewerFromSession(), id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await archivarChat(await viewerFromSession(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

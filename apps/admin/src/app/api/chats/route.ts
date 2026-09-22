import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { crearChatSchema } from "@vivero/shared";
import { createChat, listChats } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Mis chats, el más movido primero. */
export async function GET() {
  try {
    return NextResponse.json({ items: await listChats(await viewerFromSession()) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Crear un chat. Solo ADMIN: lo decide el servicio, no esta ruta. */
export async function POST(request: Request) {
  const parsed = crearChatSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const chat = await createChat(await viewerFromSession(), parsed.data);
    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

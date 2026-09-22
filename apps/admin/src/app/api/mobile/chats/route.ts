import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { crearChatSchema } from "@vivero/shared";
import { createChat, listChats } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Los chats del equipo, por la puerta de la app.
 *
 * Sin filtrar por rol acá: el servicio ya decide quién ve qué —miembro, y el
 * cliente nunca— y repetir la regla en la ruta es tener dos lugares donde se
 * puede desincronizar.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    return NextResponse.json({
      items: await listChats(viewerFromMobileUser(userOrResponse)),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
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
    const chat = await createChat(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

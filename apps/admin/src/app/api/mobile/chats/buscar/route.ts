import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { busquedaDeMensajesSchema } from "@vivero/shared";
import { buscarMensajes } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** El mismo buscador de mensajes, por la puerta de la app. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { searchParams } = new URL(request.url);
  const parsed = busquedaDeMensajesSchema.safeParse({
    q: searchParams.get("q") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ items: [] });

  try {
    return NextResponse.json({
      items: await buscarMensajes(
        viewerFromMobileUser(userOrResponse),
        parsed.data.q,
        parsed.data.limit
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

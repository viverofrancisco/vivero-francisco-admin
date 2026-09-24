import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { compartiblesQuerySchema } from "@vivero/shared";
import { compartibles } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Qué se puede compartir en un chat: visitas, clientes o productos, con búsqueda. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = compartiblesQuerySchema.safeParse({
    tipo: searchParams.get("tipo") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      items: await compartibles(await viewerFromSession(), parsed.data.tipo, parsed.data.q),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

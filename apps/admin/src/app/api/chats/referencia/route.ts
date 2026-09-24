import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { referenciaDeMensajeSchema } from "@vivero/shared";
import { vistaPreviaDeReferencia } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** La vista previa de una ficha compartida, con el acceso de quien pregunta. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = referenciaDeMensajeSchema.safeParse({
    tipo: searchParams.get("tipo") ?? undefined,
    id: searchParams.get("id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await vistaPreviaDeReferencia(await viewerFromSession(), parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

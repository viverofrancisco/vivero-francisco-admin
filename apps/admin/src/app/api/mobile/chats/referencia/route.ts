import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { referenciaDeMensajeSchema } from "@vivero/shared";
import { vistaPreviaDeReferencia } from "@/lib/services/chat.service";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";

/** La vista previa de una ficha compartida, con el acceso de quien pregunta. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { searchParams } = new URL(request.url);
  const parsed = referenciaDeMensajeSchema.safeParse({
    tipo: searchParams.get("tipo") ?? undefined,
    id: searchParams.get("id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await vistaPreviaDeReferencia(viewerFromMobileUser(userOrResponse), parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

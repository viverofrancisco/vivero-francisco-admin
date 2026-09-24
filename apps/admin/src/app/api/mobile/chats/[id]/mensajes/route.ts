import { NextResponse, after } from "next/server";
import { generarVariantesDeMensaje } from "@/lib/chats/variantes";

/**
 * Lo que dura la función, contando lo que corre **después** de contestar: las
 * versiones de las fotos y el 720p de un video, que es lo que más tarda.
 */
export const maxDuration = 300;
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { enviarMensajeSchema, mensajesQuerySchema } from "@vivero/shared";
import { enviarMensaje, listMensajes } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const parsed = mensajesQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    // Llegando desde el buscador: la conversación se abre alrededor de ese
    // mensaje, no por el final.
    alrededorDe: searchParams.get("alrededorDe") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await listMensajes(viewerFromMobileUser(userOrResponse), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = enviarMensajeSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const mensaje = await enviarMensaje(
      viewerFromMobileUser(userOrResponse),
      id,
      parsed.data
    );
    // Las tres versiones de cada foto, **después** de contestar: el ✓ no
    // espera a que el servidor baje y achique nada.
    if (mensaje.fotos.some((f) => f.tipo === "imagen" || f.tipo === "video")) {
      after(() => generarVariantesDeMensaje(mensaje.id));
    }
    return NextResponse.json(mensaje, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

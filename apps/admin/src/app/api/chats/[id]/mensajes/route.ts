import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { enviarMensajeSchema, mensajesQuerySchema } from "@vivero/shared";
import { enviarMensaje, listMensajes } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

/** Los mensajes, del más nuevo al más viejo. La pantalla los da vuelta. */
export async function GET(request: Request, { params }: Params) {
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
      await listMensajes(await viewerFromSession(), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
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
      await viewerFromSession(),
      id,
      parsed.data
    );
    return NextResponse.json(mensaje, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

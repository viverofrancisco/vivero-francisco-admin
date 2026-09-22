import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { borrarMensaje } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Borrar un mensaje: el propio cualquiera, el ajeno solo el ADMIN. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await borrarMensaje(await viewerFromSession(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

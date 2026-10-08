import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { marcarSolicitudAtendida } from "@/lib/services/solicitud.service";

const schema = z.object({ atendida: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await marcarSolicitudAtendida(
        viewerFromMobileUser(user),
        id,
        parsed.data.atendida
      )
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { setGruposDePersonal } from "@/lib/services/grupo.service";

const bodySchema = z.object({ grupoIds: z.array(z.string().min(1)).max(100) });

/** En qué cuadrillas está esta persona: la lista entera, desde su ficha. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json({
      grupos: await setGruposDePersonal(
        viewerFromMobileUser(userOrResponse),
        id,
        parsed.data.grupoIds
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listTareasParaInforme } from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

const schema = z.object({
  visitaIds: z.array(z.string().min(1)).min(1).max(200),
});

/** Las tareas que se hicieron en esas visitas — el origen de las secciones. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const items = await listTareasParaInforme(
      viewerFromMobileUser(userOrResponse),
      parsed.data.visitaIds
    );
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

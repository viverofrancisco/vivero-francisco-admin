import { NextResponse } from "next/server";
import { clientesInactivoEnLoteSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { marcarVariosClientesInactivos } from "@/lib/services/cliente.service";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";

/** Marcar varios clientes como inactivos, o reactivarlos, desde la selección. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = clientesInactivoEnLoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Selecciona al menos un cliente." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await marcarVariosClientesInactivos(
        viewerFromMobileUser(userOrResponse),
        parsed.data.ids,
        parsed.data.inactivo
      )
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

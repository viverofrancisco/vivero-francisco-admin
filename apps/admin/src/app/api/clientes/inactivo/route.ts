import { NextResponse } from "next/server";
import { clientesInactivoEnLoteSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { marcarVariosClientesInactivos } from "@/lib/services/cliente.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Marcar varios clientes como inactivos, o reactivarlos, desde la selección. */
export async function POST(request: Request) {
  const parsed = clientesInactivoEnLoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Selecciona al menos un cliente." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await marcarVariosClientesInactivos(await viewerFromSession(), parsed.data.ids, parsed.data.inactivo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

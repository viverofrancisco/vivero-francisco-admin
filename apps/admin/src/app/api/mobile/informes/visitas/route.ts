import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listVisitasParaInforme } from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json(
      { error: "clienteId requerido" },
      { status: 400 }
    );
  }
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
  const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : undefined;

  try {
    const items = await listVisitasParaInforme(
      viewerFromMobileUser(userOrResponse),
      clienteId,
      { from, to }
    );
    return NextResponse.json({
      items: items.map((v) => ({
        id: v.id,
        fechaProgramada:
          v.fechaProgramada instanceof Date
            ? v.fechaProgramada.toISOString()
            : v.fechaProgramada,
        estado: v.estado,
        servicioNombre: v.servicioNombre,
        fotosCount: v.fotosCount,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

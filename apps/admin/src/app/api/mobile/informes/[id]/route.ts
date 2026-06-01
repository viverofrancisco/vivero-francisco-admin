import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  deleteInforme,
  getInforme,
} from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    const informe = await getInforme(viewerFromMobileUser(userOrResponse), id);
    return NextResponse.json({
      id: informe.id,
      titulo: informe.titulo,
      fechaDesde: informe.fechaDesde?.toISOString() ?? null,
      fechaHasta: informe.fechaHasta?.toISOString() ?? null,
      pdfUrl: informe.pdfUrl,
      generatedAt: informe.generatedAt.toISOString(),
      cliente: {
        id: informe.cliente.id,
        nombre: `${informe.cliente.nombre} ${informe.cliente.apellido ?? ""}`.trim(),
      },
      visitasCount: informe.visitas.length,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    await deleteInforme(viewerFromMobileUser(userOrResponse), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { crearEmisor, listarEmisores } from "@/lib/services/emisor.service";
import { cifradoConfigurado } from "@/lib/sri/cifrado";
import { emisorSchema } from "@/lib/validations/emisor";

/**
 * Los emisores como configuración —la pantalla *Facturación electrónica*—,
 * para el ADMIN. `/api/mobile/emisores` es otra cosa: lo mínimo para elegir
 * uno al emitir, que también ve el STAFF.
 */
export async function GET(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  try {
    const emisores = await listarEmisores(viewerFromMobileUser(u));
    return NextResponse.json({
      cifradoListo: cifradoConfigurado(),
      items: emisores.map(({ _count, ...e }) => ({
        ...e,
        certificadoVence: e.certificadoVence?.toISOString() ?? null,
        facturas: _count.facturas,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = emisorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearEmisor(viewerFromMobileUser(u), parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

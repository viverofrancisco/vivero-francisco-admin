import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  crearDatoFacturacion,
  listarDatosFacturacion,
} from "@/lib/services/dato-facturacion.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { datoFacturacionSchema } from "@/lib/validations/facturacion";

/**
 * A nombre de quién se le puede facturar a un cliente, y cargar uno nuevo con
 * el cliente delante: lo que el armador del portal hace con *Usar otros datos*.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    return NextResponse.json({ items: await listarDatosFacturacion(id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = datoFacturacionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await crearDatoFacturacion(viewerFromMobileUser(userOrResponse), id, parsed.data),
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

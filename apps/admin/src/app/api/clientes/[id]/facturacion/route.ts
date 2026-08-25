import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  crearDatoFacturacion,
  listarDatosFacturacion,
} from "@/lib/services/dato-facturacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { datoFacturacionSchema } from "@/lib/validations/facturacion";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await viewerFromSession();
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
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = datoFacturacionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await crearDatoFacturacion(viewer, id, parsed.data),
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

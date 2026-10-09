import { NextResponse } from "next/server";
import { centroCostoSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearCentroCosto, listarCentrosCosto } from "@/lib/services/centro-costo.service";

export async function GET() {
  try {
    return NextResponse.json(await listarCentrosCosto(await viewerFromSession()));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = centroCostoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearCentroCosto(await viewerFromSession(), parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

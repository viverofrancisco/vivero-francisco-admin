import { NextResponse } from "next/server";
import { obraSchema, type EstadoObra } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearObra, listarObras } from "@/lib/services/obra.service";

const ESTADOS: EstadoObra[] = ["EN_CURSO", "TERMINADA", "CANCELADA"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const estado = url.searchParams.get("estado") as EstadoObra | null;
  try {
    return NextResponse.json(
      await listarObras(await viewerFromSession(), {
        q: url.searchParams.get("q") ?? undefined,
        estado: estado && ESTADOS.includes(estado) ? estado : undefined,
        centroCostoId: url.searchParams.get("centro") ?? undefined,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = obraSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearObra(await viewerFromSession(), parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

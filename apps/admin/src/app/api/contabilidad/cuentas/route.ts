import { NextResponse } from "next/server";
import { crearCuentaSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearCuenta, listarCuentas } from "@/lib/services/cuenta-contable.service";

export async function GET() {
  try {
    return NextResponse.json(await listarCuentas(await viewerFromSession()));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = crearCuentaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearCuenta(await viewerFromSession(), parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

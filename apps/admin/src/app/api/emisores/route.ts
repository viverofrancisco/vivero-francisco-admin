import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { crearEmisor, listarEmisores } from "@/lib/services/emisor.service";
import { emisorSchema } from "@/lib/validations/emisor";

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    return NextResponse.json(await listarEmisores(viewer));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = emisorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await crearEmisor(viewer, parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

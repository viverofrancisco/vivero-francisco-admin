import { NextResponse } from "next/server";
import { informeGenerateSchema } from "@/lib/validations/informe";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  generateInforme,
  listInformes,
} from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId") ?? undefined;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
  const to = toStr ? new Date(`${toStr}T00:00:00.000Z`) : undefined;
  const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(url.searchParams.get("limit") ?? 30) || 30;
  try {
    const result = await listInformes(viewer, {
      clienteId,
      from,
      to,
      offset,
      limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const generateSchema = informeGenerateSchema;

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = generateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const result = await generateInforme(viewer, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

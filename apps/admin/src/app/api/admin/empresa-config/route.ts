import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  getEmpresaConfig,
  updateEmpresaConfig,
} from "@/lib/services/empresa-config.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET() {
  await viewerFromSession();
  const cfg = await getEmpresaConfig();
  return NextResponse.json(cfg);
}

const updateSchema = z.object({
  nombre: z.string().max(100).nullable().optional(),
  logoKey: z.string().min(1).max(500).nullable().optional(),
  logoUrl: z.string().url().max(1000).nullable().optional(),
});

export async function PUT(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = updateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const result = await updateEmpresaConfig(viewer, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

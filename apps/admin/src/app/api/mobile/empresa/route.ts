import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import {
  getEmpresaConfig,
  updateEmpresaConfig,
} from "@/lib/services/empresa-config.service";

/**
 * El nombre y el logo del vivero, desde la app. Gemela de
 * `/api/admin/empresa-config`; como la pantalla del portal, es del ADMIN.
 */
export async function GET(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  return NextResponse.json(await getEmpresaConfig());
}

const schema = z.object({
  nombre: z.string().max(100).nullable().optional(),
  logoKey: z.string().min(1).max(500).nullable().optional(),
  logoUrl: z.string().url().max(1000).nullable().optional(),
});

export async function PUT(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateEmpresaConfig(viewerFromMobileUser(u), parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

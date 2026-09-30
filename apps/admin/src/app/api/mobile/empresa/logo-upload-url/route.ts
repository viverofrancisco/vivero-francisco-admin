import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { urlParaSubirLogo } from "@/lib/services/empresa-config.service";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive().optional(),
});

/** Gemela de `/api/admin/empresa-config/logo-upload-url`. */
export async function POST(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await urlParaSubirLogo(viewerFromMobileUser(u), parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

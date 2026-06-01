import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { viewerFromSession } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const schema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  if (!isAdminRole(viewer.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { fileName, contentType, size } = parsed.data;
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa PNG, JPG o WEBP." },
      { status: 400 }
    );
  }
  if (size !== undefined && size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Imagen demasiado grande (máx 2MB)" },
      { status: 400 }
    );
  }
  const ext = (fileName.split(".").pop() || "png").toLowerCase();
  const key = `empresa/logo-${randomUUID()}.${ext}`;
  const uploadUrl = await getUploadUrl(key, contentType);
  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: publicUrlForKey(key),
  });
}

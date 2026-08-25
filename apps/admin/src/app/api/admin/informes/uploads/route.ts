import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { requestInformeUploadUrls } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { informeUploadUrlsSchema } from "@/lib/validations/informe";

/**
 * URLs prefirmadas para subir imágenes propias de una sección del informe
 * (las que no vienen de una visita).
 */
export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = informeUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const uploads = await requestInformeUploadUrls(
      viewer,
      parsed.data.clienteId,
      parsed.data.files
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

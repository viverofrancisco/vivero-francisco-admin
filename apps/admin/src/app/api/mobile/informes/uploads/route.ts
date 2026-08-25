import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { requestInformeUploadUrls } from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { informeUploadUrlsSchema } from "@/lib/validations/informe";

/**
 * URLs prefirmadas para subir imágenes propias de una sección del informe
 * (las que no vienen de una visita).
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = informeUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const uploads = await requestInformeUploadUrls(
      viewerFromMobileUser(userOrResponse),
      parsed.data.clienteId,
      parsed.data.files
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

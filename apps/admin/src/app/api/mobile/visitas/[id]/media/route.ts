import { NextResponse } from "next/server";
import { requestUploadUrlsSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { requestVisitaMediaUploads } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Sin lista de roles: `ensurePuedeTocarArchivos` decide —la oficina y el
  // jardinero **asignado**, nunca el cliente—. Decía "ADMIN" y nada más, así
  // que quien está en el jardín no podía subir la foto que acababa de sacar.
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = requestUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const uploads = await requestVisitaMediaUploads(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data.files
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

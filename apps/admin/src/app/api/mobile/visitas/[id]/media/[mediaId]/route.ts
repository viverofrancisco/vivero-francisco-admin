import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { removeVisitaMedia } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id, mediaId } = await params;
  try {
    await removeVisitaMedia(id, mediaId, viewerFromMobileUser(userOrResponse));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

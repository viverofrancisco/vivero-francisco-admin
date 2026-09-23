import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { infoDeMensaje } from "@/lib/services/chat.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Quién leyó un mensaje propio, y cuándo. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    return NextResponse.json(
      await infoDeMensaje(viewerFromMobileUser(userOrResponse), id)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

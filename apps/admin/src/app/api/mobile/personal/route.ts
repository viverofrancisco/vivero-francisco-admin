import { NextResponse } from "next/server";
import { personalSchema } from "@/lib/validations/personal";
import { requireMobileUser, requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { crearPersonal, listPersonal } from "@/lib/services/personal.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** La gente del vivero. La autorización la decide el servicio. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const items = await listPersonal(viewerFromMobileUser(userOrResponse));
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = personalSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const personal = await crearPersonal(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(personal, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

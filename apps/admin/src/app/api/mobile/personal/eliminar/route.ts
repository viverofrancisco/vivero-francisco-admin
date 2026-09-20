import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { eliminarEnLoteSchema } from "@/lib/validations/personal";
import { archivarVariosPersonal } from "@/lib/services/personal.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** El mismo borrado en lote que el portal, por la puerta de la app. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = eliminarEnLoteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await archivarVariosPersonal(
        viewerFromMobileUser(userOrResponse),
        parsed.data.ids
      )
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

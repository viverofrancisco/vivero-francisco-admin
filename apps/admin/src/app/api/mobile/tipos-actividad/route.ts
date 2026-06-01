import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listTiposActividad } from "@/lib/services/tipo-actividad.service";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const items = await listTiposActividad();
  return NextResponse.json({ items });
}

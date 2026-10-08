import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { listarCatalogo } from "@/lib/services/catalogo.service";

/** La vidriera: lo que se vende, con foto y precio con IVA. */
export async function GET(request: Request) {
  const user = await requireMobileUser(request);
  if (!isMobileUser(user)) return user;

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 40);
  try {
    return NextResponse.json(
      await listarCatalogo({
        search: url.searchParams.get("search") ?? undefined,
        offset: Number.isFinite(offset) ? offset : 0,
        limit: Number.isFinite(limit) ? limit : 40,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { logoutSchema } from "@vivero/shared";
import { revokeRefreshToken } from "@/lib/mobile/tokens";

export async function POST(request: Request) {
  const parsed = logoutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await revokeRefreshToken(parsed.data.refreshToken);
  return NextResponse.json({ ok: true });
}

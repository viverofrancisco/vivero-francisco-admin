import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeRefreshToken } from "@/lib/mobile/tokens";

const bodySchema = z.object({
  refreshToken: z.string().min(10),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await revokeRefreshToken(parsed.data.refreshToken);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { rotateRefreshToken } from "@/lib/mobile/tokens";

const bodySchema = z.object({
  refreshToken: z.string().min(10),
});

const REASON_MESSAGES: Record<string, string> = {
  invalid: "Sesión inválida.",
  expired: "Sesión expirada. Inicia sesión nuevamente.",
  reused: "Detectamos reuso del token. Inicia sesión nuevamente.",
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const deviceInfo =
    request.headers.get("user-agent")?.slice(0, 200) ?? null;

  const result = await rotateRefreshToken(parsed.data.refreshToken, deviceInfo);
  if (!result.ok) {
    return NextResponse.json(
      { error: REASON_MESSAGES[result.reason] },
      { status: 401 }
    );
  }

  return NextResponse.json(result.tokens);
}

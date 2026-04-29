import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileUser } from "@/lib/mobile/auth";
import { isValidExpoToken } from "@/lib/push/expo";

const bodySchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { token, platform, deviceName } = parsed.data;
  if (!isValidExpoToken(token)) {
    return NextResponse.json(
      { error: "Formato de token Expo inválido" },
      { status: 400 }
    );
  }

  const record = await prisma.pushToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      deviceName: deviceName ?? null,
      userId: user.id,
    },
    update: {
      platform,
      deviceName: deviceName ?? null,
      userId: user.id,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: record.id });
}

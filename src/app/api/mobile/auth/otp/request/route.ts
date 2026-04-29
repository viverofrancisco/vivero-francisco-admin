import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOtpForPhone, normalizePhone, otpConfig } from "@/lib/mobile/otp";
import { enforceOtpRequestLimit } from "@/lib/mobile/rate-limit";
import { enviarOtpWhatsApp } from "@/lib/whatsapp/service";

const bodySchema = z.object({
  phone: z.string().min(7).max(20),
});

const GENERIC_404 = {
  error: "No pudimos verificar ese número. Contacta al vivero.",
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
  }

  const normalized = normalizePhone(parsed.data.phone);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const limit = await enforceOtpRequestLimit(normalized, ip);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const matches = await prisma.cliente.findMany({
    where: { deletedAt: null, telefono: { not: null } },
    select: { id: true, telefono: true },
  });

  const candidates = matches.filter(
    (c) => c.telefono && normalizePhone(c.telefono) === normalized
  );

  if (candidates.length !== 1) {
    return NextResponse.json(GENERIC_404, { status: 404 });
  }

  const cliente = candidates[0];
  const code = await createOtpForPhone(normalized);

  const result = await enviarOtpWhatsApp(normalized, code, cliente.id);
  if (!result.success) {
    return NextResponse.json(
      { error: "No pudimos enviar el código. Intenta de nuevo." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, expiresIn: otpConfig.ttlSeconds });
}

import { NextResponse } from "next/server";
import { otpVerifySchema } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { normalizePhone, verifyOtpCode } from "@/lib/mobile/otp";
import { issueTokenPair } from "@/lib/mobile/tokens";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Solicita un código primero.",
  expired: "El código expiró. Solicita uno nuevo.",
  max_attempts: "Demasiados intentos. Solicita un código nuevo.",
  invalid_code: "Código incorrecto.",
};

export async function POST(request: Request) {
  const parsed = otpVerifySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { phone, code } = parsed.data;
  const normalized = normalizePhone(phone);

  const result = await verifyOtpCode(normalized, code);
  if (!result.ok) {
    const message = result.reason ? ERROR_MESSAGES[result.reason] : "Código inválido";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const matches = await prisma.cliente.findMany({
    where: { deletedAt: null, telefono: { not: null } },
    select: {
      id: true,
      telefono: true,
      nombre: true,
      apellido: true,
      email: true,
      userId: true,
    },
  });
  const candidates = matches.filter(
    (c) => c.telefono && normalizePhone(c.telefono) === normalized
  );
  if (candidates.length !== 1) {
    return NextResponse.json(
      { error: "No pudimos verificar ese número. Contacta al vivero." },
      { status: 404 }
    );
  }

  const cliente = candidates[0];

  const user = await prisma.$transaction(async (tx) => {
    if (cliente.userId) {
      const existing = await tx.user.findUnique({
        where: { id: cliente.userId },
      });
      if (existing) return existing;
    }

    const email =
      cliente.email ?? `cliente+${cliente.id}@viverofrancisco.local`;

    // For CLIENTE users we deliberately leave name/apellido NULL on User —
    // the source of truth lives on Cliente. The User row exists only for
    // auth (token issuance, audit FKs). When we display the cliente's name
    // anywhere, we read it from Cliente, not from User.
    const created = await tx.user.create({
      data: {
        role: "CLIENTE",
        email,
      },
    });

    await tx.cliente.update({
      where: { id: cliente.id },
      data: { userId: created.id },
    });

    return created;
  });

  const deviceInfo =
    request.headers.get("user-agent")?.slice(0, 200) ?? null;

  const tokens = await issueTokenPair({
    userId: user.id,
    role: user.role,
    personalId: null,
    clienteId: cliente.id,
    deviceInfo,
  });

  return NextResponse.json({
    ...tokens,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      apellido: user.apellido,
    },
  });
}

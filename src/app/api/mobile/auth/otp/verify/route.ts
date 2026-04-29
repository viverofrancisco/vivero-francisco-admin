import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, verifyOtpCode } from "@/lib/mobile/otp";
import { issueTokenPair } from "@/lib/mobile/tokens";

const bodySchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().regex(/^\d{6}$/, "Código inválido"),
});

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Solicita un código primero.",
  expired: "El código expiró. Solicita uno nuevo.",
  max_attempts: "Demasiados intentos. Solicita un código nuevo.",
  invalid_code: "Código incorrecto.",
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
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

    const created = await tx.user.create({
      data: {
        role: "CLIENTE",
        name: cliente.nombre,
        apellido: cliente.apellido,
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

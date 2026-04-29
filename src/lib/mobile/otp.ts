import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";

const OTP_TTL_SECONDS = 5 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

export function generateOtpCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export function normalizePhone(phone: string): string {
  return formatForWhatsApp(phone);
}

export async function createOtpForPhone(phone: string): Promise<string> {
  const normalized = normalizePhone(phone);
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { phone: normalized, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: { phone: normalized, codeHash, expiresAt },
    }),
  ]);

  return code;
}

export interface OtpVerifyResult {
  ok: boolean;
  reason?: "not_found" | "expired" | "max_attempts" | "invalid_code";
}

export async function verifyOtpCode(
  phone: string,
  code: string
): Promise<OtpVerifyResult> {
  const normalized = normalizePhone(phone);
  const otp = await prisma.otpCode.findFirst({
    where: { phone: normalized, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, reason: "not_found" };

  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "max_attempts" };
  }

  const matches = await bcrypt.compare(code, otp.codeHash);
  if (!matches) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid_code" };
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  return { ok: true };
}

export const otpConfig = {
  ttlSeconds: OTP_TTL_SECONDS,
  maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
};

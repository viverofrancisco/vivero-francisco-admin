import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  sha256,
  tokenTtl,
} from "./jwt";
import type { UserRole } from "@/generated/prisma/client";

const REFRESH_GRACE_SECONDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface IssueParams {
  userId: string;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
  deviceInfo?: string | null;
}

export async function issueTokenPair(params: IssueParams): Promise<TokenPair> {
  const accessToken = await signAccessToken({
    sub: params.userId,
    role: params.role,
    personalId: params.personalId,
    clienteId: params.clienteId,
  });

  const { token: refreshToken, tokenHash, expiresAt } = await signRefreshToken(
    params.userId
  );

  await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt,
      deviceInfo: params.deviceInfo ?? null,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: tokenTtl.accessSeconds,
  };
}

export type RotateResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

export async function rotateRefreshToken(
  refreshToken: string,
  deviceInfo?: string | null
): Promise<RotateResult> {
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) return { ok: false, reason: "invalid" };

  const hash = sha256(refreshToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.userId !== payload.sub) return { ok: false, reason: "invalid" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (record.revokedAt) {
    const ageMs = Date.now() - record.revokedAt.getTime();
    if (ageMs > REFRESH_GRACE_SECONDS * 1000) {
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { ok: false, reason: "reused" };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    include: {
      personal: { select: { id: true } },
      cliente: { select: { id: true } },
    },
  });
  if (!user) return { ok: false, reason: "invalid" };

  if (!record.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
  }

  const tokens = await issueTokenPair({
    userId: user.id,
    role: user.role,
    personalId: user.personal?.id ?? null,
    clienteId: user.cliente?.id ?? null,
    deviceInfo,
  });

  return { ok: true, tokens };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const hash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

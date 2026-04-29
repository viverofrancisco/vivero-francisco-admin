import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import type { UserRole } from "@/generated/prisma/client";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const ISSUER = "vivero-francisco";
const ACCESS_AUDIENCE = "mobile-access";
const REFRESH_AUDIENCE = "mobile-refresh";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

function getAccessSecret(): Uint8Array {
  const s = process.env.MOBILE_ACCESS_SECRET;
  if (!s) throw new Error("MOBILE_ACCESS_SECRET not set");
  return new TextEncoder().encode(s);
}

function getRefreshSecret(): Uint8Array {
  const s = process.env.MOBILE_REFRESH_SECRET;
  if (!s) throw new Error("MOBILE_REFRESH_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({
    role: payload.role,
    personalId: payload.personalId,
    clienteId: payload.clienteId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(getAccessSecret());
}

export async function signRefreshToken(
  userId: string
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const jti = randomBytes(16).toString("hex");
  const token = await new SignJWT({ jti })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(getRefreshSecret());

  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  return { token, tokenHash, expiresAt };
}

export async function verifyAccessToken(
  jwt: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(jwt, getAccessSecret(), {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    });
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub as string,
      role: payload.role as UserRole,
      personalId: (payload.personalId as string | null) ?? null,
      clienteId: (payload.clienteId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  jwt: string
): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(jwt, getRefreshSecret(), {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    });
    if (!payload.sub || !payload.jti) return null;
    return { sub: payload.sub as string, jti: payload.jti as string };
  } catch {
    return null;
  }
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export const tokenTtl = {
  accessSeconds: ACCESS_TTL_SECONDS,
  refreshSeconds: REFRESH_TTL_SECONDS,
};

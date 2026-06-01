import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "./jwt";
import type { UserRole } from "@/generated/prisma/client";

export interface MobileUser {
  id: string;
  email: string;
  name: string | null;
  apellido: string | null;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
}

export async function getMobileUser(
  request: Request
): Promise<MobileUser | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      personal: { select: { id: true } },
      cliente: { select: { id: true } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    apellido: user.apellido,
    role: user.role,
    personalId: user.personal?.id ?? null,
    clienteId: user.cliente?.id ?? null,
  };
}

export function unauthorized(message = "No autorizado") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "No tienes permiso para esta acción") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireMobileUser(
  request: Request
): Promise<MobileUser | NextResponse> {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return user;
}

export async function requireMobileRole(
  request: Request,
  ...roles: UserRole[]
): Promise<MobileUser | NextResponse> {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  if (!roles.includes(user.role)) return forbidden();
  return user;
}

export function isMobileUser(
  value: MobileUser | NextResponse
): value is MobileUser {
  return !(value instanceof NextResponse);
}

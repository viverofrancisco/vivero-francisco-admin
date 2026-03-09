import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

export async function getUserSectorIds(userId: string): Promise<string[]> {
  const assignments = await prisma.sectorAdmin.findMany({
    where: { userId },
    select: { sectorId: true },
  });
  return assignments.map((a) => a.sectorId);
}

export function isReadOnly(role: UserRole): boolean {
  return role === "JARDINERO";
}

export function isJardineroRole(role: UserRole): boolean {
  return role === "JARDINERO_ADMIN" || role === "JARDINERO";
}

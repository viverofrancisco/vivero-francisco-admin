import type { UserRole } from "@/generated/prisma/client";

export interface Viewer {
  id: string;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function isPersonalRole(role: UserRole): boolean {
  return role === "PERSONAL" || role === "PERSONAL_ADMIN";
}

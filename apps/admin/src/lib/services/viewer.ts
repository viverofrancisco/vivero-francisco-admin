import type { UserRole } from "@/generated/prisma/client";

export interface Viewer {
  id: string;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
  /**
   * Cómo se llama, para dejarlo escrito donde haga falta.
   *
   * Lo que se guarda en un registro histórico —"esta visita la cerró fulano"—
   * es el nombre, no solo el id: el id se puede quedar sin dueño si la cuenta
   * se elimina, y el nombre puede cambiar después sin que eso deba reescribir
   * lo que pasó. El id se guarda igual, para poder filtrar por persona.
   */
  nombre: string | null;
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function isPersonalRole(role: UserRole): boolean {
  return role === "PERSONAL" || role === "PERSONAL_ADMIN";
}

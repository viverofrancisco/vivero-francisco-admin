import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-helpers";

/**
 * Configuración no tiene página propia: abre la primera sección que este rol
 * puede ver. Staff entra por Personal; el administrador, por Usuarios.
 */
export default async function ConfiguracionPage() {
  const user = await requireStaff();
  redirect(user.role === "ADMIN" ? "/dashboard/configuracion/usuarios" : "/dashboard/personal");
}

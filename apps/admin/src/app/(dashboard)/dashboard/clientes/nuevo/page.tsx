import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { ClienteForm } from "@/components/clientes/cliente-form";

export default async function NuevoClientePage() {
  const user = await requireAuth();

  if (user.role === "PERSONAL_ADMIN" || user.role === "PERSONAL") {
    redirect("/dashboard/clientes");
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ClienteForm />
    </div>
  );
}

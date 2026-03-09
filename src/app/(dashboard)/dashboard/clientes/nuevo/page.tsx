import { requireAuth } from "@/lib/auth-helpers";
import { ClienteForm } from "@/components/clientes/cliente-form";

export default async function NuevoClientePage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <ClienteForm />
    </div>
  );
}

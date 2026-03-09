import { requireAuth } from "@/lib/auth-helpers";
import { ServicioForm } from "@/components/servicios/servicio-form";

export default async function NuevoServicioPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <ServicioForm />
    </div>
  );
}

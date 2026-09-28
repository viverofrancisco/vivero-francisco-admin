import { requireAuth } from "@/lib/auth-helpers";
import { PersonalForm } from "@/components/personal/personal-form";

export default async function NuevoPersonalPage() {
  await requireAuth();

  return (
    // Sin relleno en el teléfono: el formulario trae su encabezado pegado
    // arriba, de borde a borde, y pone el suyo al cuerpo.
    <div className="md:p-6">
      <PersonalForm />
    </div>
  );
}

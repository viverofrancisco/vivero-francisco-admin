import { requireAuth } from "@/lib/auth-helpers";
import { PersonalForm } from "@/components/personal/personal-form";

export default async function NuevoPersonalPage() {
  await requireAuth();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PersonalForm />
    </div>
  );
}

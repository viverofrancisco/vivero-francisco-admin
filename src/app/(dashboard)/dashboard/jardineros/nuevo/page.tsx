import { requireAuth } from "@/lib/auth-helpers";
import { JardineroForm } from "@/components/jardineros/jardinero-form";

export default async function NuevoJardineroPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <JardineroForm />
    </div>
  );
}

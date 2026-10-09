import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { listarCuentas } from "@/lib/services/cuenta-contable.service";
import { PlanDeCuentas } from "@/components/contabilidad/plan-de-cuentas";

export default async function PlanDeCuentasPage() {
  await requireStaff();
  const cuentas = await listarCuentas(await viewerFromSession());
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <PlanDeCuentas cuentas={cuentas} />
    </div>
  );
}

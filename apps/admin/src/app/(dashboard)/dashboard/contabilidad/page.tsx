import { redirect } from "next/navigation";

/** Por ahora la contabilidad es el plan de cuentas; se suman pantallas. */
export default function ContabilidadPage() {
  redirect("/dashboard/contabilidad/plan-de-cuentas");
}

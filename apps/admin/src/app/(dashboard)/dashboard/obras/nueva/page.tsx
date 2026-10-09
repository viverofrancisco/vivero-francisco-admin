import { requireStaff } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { ObraForm } from "@/components/obras/obra-form";
import { centrosParaObra, clientesParaObra } from "../clientes-para-obra";

export default async function NuevaObraPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireStaff();
  const { from } = await searchParams;
  return (
    <div className="md:p-6">
      <ObraForm
        obra={null}
        clientes={await clientesParaObra()}
        centros={await centrosParaObra()}
        volverA={hrefDeVuelta(from, "/dashboard/obras")}
      />
    </div>
  );
}

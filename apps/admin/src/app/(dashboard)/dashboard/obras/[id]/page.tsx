import { notFound } from "next/navigation";
import { requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { obtenerObra } from "@/lib/services/obra.service";
import { NotFoundError } from "@/lib/services/errors";
import { ObraForm } from "@/components/obras/obra-form";
import { centrosParaObra, clientesParaObra } from "../clientes-para-obra";

export default async function ObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireStaff();
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const obra = await obtenerObra(await viewerFromSession(), id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <div className="md:p-6">
      <ObraForm
        obra={obra}
        clientes={await clientesParaObra()}
        centros={await centrosParaObra()}
        volverA={hrefDeVuelta(from, "/dashboard/obras")}
      />
    </div>
  );
}

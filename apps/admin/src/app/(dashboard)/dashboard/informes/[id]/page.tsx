import { notFound } from "next/navigation";
import { nombreCliente } from "@vivero/shared";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { getInforme } from "@/lib/services/informe.service";
import { hrefDeVuelta } from "@/lib/navegacion";
import { InformeDetail } from "@/components/informes/informe-detail";

export default async function InformeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const { id } = await params;
  const { from } = await searchParams;

  let informe;
  try {
    informe = await getInforme(viewer, id);
  } catch {
    notFound();
  }
  if (!informe) notFound();

  // `firmantes` es JSON: lo que hay adentro no lo garantiza el esquema.
  const firmantesRaw = informe.firmantes as
    | Array<{ nombre?: unknown; cedula?: unknown }>
    | null
    | undefined;
  const firmantes = (firmantesRaw ?? [])
    .filter(
      (f): f is { nombre: string } =>
        typeof f?.nombre === "string" && f.nombre.length > 0
    )
    .map((f) => ({
      nombre: f.nombre,
      cedula:
        "cedula" in f && typeof (f as { cedula: unknown }).cedula === "string"
          ? ((f as { cedula: string }).cedula as string)
          : null,
    }));

  const generadoPor = informe.generatedBy
    ? `${informe.generatedBy.name ?? ""} ${informe.generatedBy.apellido ?? ""}`.trim()
    : "";

  return (
    <div className="h-full p-4 md:p-6">
      <InformeDetail
        backHref={hrefDeVuelta(from, "/dashboard/informes")}
        informe={{
          id: informe.id,
          numero: informe.numero,
          titulo: informe.titulo,
          fecha: informe.fecha.toISOString().split("T")[0],
          generatedAt: informe.generatedAt.toISOString(),
          pdfUrl: informe.pdfUrl,
          cliente: {
            id: informe.cliente.id,
            nombre: nombreCliente(informe.cliente),
          },
          generadoPor: generadoPor || null,
          firmantes,
          visitas: informe.visitas
            .filter((v) => v.visita != null)
            .map((v) => ({
              id: v.visita.id,
              numero: v.visita.numero,
              estado: v.visita.estado,
              fecha: (
                v.visita.fechaRealizada ?? v.visita.fechaProgramada
              ).toISOString(),
            })),
          secciones: informe.secciones.map((s) => ({
            titulo: s.titulo,
            fotos: s.fotos.length,
          })),
        }}
      />
    </div>
  );
}

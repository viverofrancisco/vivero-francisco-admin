import { notFound } from "next/navigation";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { getInforme } from "@/lib/services/informe.service";
import { InformeWizard } from "@/components/informes/informe-wizard";

export default async function InformeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const { id } = await params;

  let informe;
  try {
    informe = await getInforme(viewer, id);
  } catch {
    notFound();
  }
  if (!informe) notFound();

  const firmantesRaw = informe.firmantes as
    | Array<{ nombre?: unknown; cedula?: unknown }>
    | null
    | undefined;
  const firmantes = (firmantesRaw ?? [])
    .filter((f): f is { nombre: string } =>
      typeof f?.nombre === "string" && f.nombre.length > 0
    )
    .map((f) => ({
      nombre: String(f.nombre),
      cedula:
        "cedula" in f && typeof (f as { cedula: unknown }).cedula === "string"
          ? ((f as { cedula: string }).cedula as string)
          : null,
    }));

  const initial = {
    informeId: informe.id,
    clienteId: informe.clienteId,
    titulo: informe.titulo,
    visitaIds: informe.visitas.map((v) => v.visitaId),
    firmantes,
    secciones: informe.secciones.map((s) => ({
      productoId: s.productoId,
      titulo: s.titulo,
      descripcion: s.descripcion,
      fotos: s.fotos.map((f) => ({
        visitaMediaId: f.visitaMediaId,
        key: f.key,
        url: f.url,
      })),
    })),
    pdfUrl: informe.pdfUrl,
  };

  return <InformeWizard initial={initial} />;
}

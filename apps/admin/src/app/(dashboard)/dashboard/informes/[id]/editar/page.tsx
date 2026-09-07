import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireStaff, viewerFromSession } from "@/lib/auth-helpers";
import { getInforme } from "@/lib/services/informe.service";
import { listDefaultFirmantes } from "@/lib/services/firmante.service";
import {
  InformeWizard,
  type EstadoInicialInforme,
} from "@/components/informes/informe-wizard";

/**
 * Editar un informe ya emitido.
 *
 * Guardar no lo pisa: crea una versión nueva y deja la anterior con su PDF, así
 * que el que el cliente tiene en la mano se sigue pudiendo abrir. El número no
 * cambia — es el mismo informe corregido, no otro.
 */
export default async function EditarInformePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  await requireAuth();
  const { id } = await params;
  const viewer = await viewerFromSession();

  const informe = await getInforme(viewer, id).catch(() => null);
  if (!informe) notFound();

  const catalogo = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
  const defaults = await listDefaultFirmantes();

  const firmantesGuardados = Array.isArray(informe.firmantes)
    ? (informe.firmantes as Array<{ nombre?: string; cedula?: string | null }>)
    : [];

  const inicial: EstadoInicialInforme = {
    clienteId: informe.clienteId,
    titulo: informe.titulo,
    // `toISOString` sobre una columna `date` la devuelve a medianoche UTC, que
    // en Ecuador es el día anterior. Se corta el texto, que ya es el día.
    fecha: informe.fecha.toISOString().slice(0, 10),
    visitaIds: informe.visitas.map((v) => v.visitaId),
    firmantes: firmantesGuardados
      .filter((f) => f.nombre)
      .map((f) => ({ nombre: f.nombre!, cedula: f.cedula ?? null })),
    secciones: informe.secciones.map((sec) => ({
      productoId: sec.productoId,
      titulo: sec.titulo,
      descripcion: sec.descripcion ?? "",
      saltoDePagina: sec.saltoDePagina,
      fotosPorFila: (sec.fotosPorFila === 2 || sec.fotosPorFila === 4
        ? sec.fotosPorFila
        : 3) as 2 | 3 | 4,
      fotos: sec.fotos.map((f) => ({
        visitaMediaId: f.visitaMediaId,
        mediaId: f.mediaId,
        url: f.url,
      })),
    })),
  };

  return (
    <InformeWizard
      catalogo={catalogo}
      defaultFirmantes={defaults.map((f) => ({
        nombre: f.nombre,
        cedula: f.cedula,
      }))}
      inicial={inicial}
      editando={{ id: informe.id, numero: informe.numero }}
    />
  );
}

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ borrador?: string }>;
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

  /**
   * Una edición dejada a medias.
   *
   * Gana sobre lo guardado en el informe: es lo último que esa persona estuvo
   * escribiendo. El informe publicado no cambió —el borrador no lo toca— así
   * que descartar el borrador siempre devuelve a la versión vigente.
   */
  const { borrador: borradorId } = await searchParams;
  const borrador = borradorId
    ? await prisma.informeBorrador.findFirst({
        where: { id: borradorId, informeId: id },
        select: { id: true, contenido: true },
      })
    : null;

  const delInforme: EstadoInicialInforme = {
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
      inicial={contenidoDelBorrador(borrador?.contenido) ?? delInforme}
      borradorId={borrador?.id}
      editando={{ id: informe.id, numero: informe.numero }}
    />
  );
}

/** Un borrador guardado con otra forma no puede voltear la pantalla. */
function contenidoDelBorrador(
  contenido: unknown
): EstadoInicialInforme | undefined {
  if (!contenido || typeof contenido !== "object") return undefined;
  const c = contenido as Partial<EstadoInicialInforme>;
  if (!Array.isArray(c.secciones) || typeof c.titulo !== "string") {
    return undefined;
  }
  return {
    paso: typeof c.paso === "number" ? c.paso : undefined,
    clienteId: c.clienteId ?? null,
    titulo: c.titulo,
    fecha: typeof c.fecha === "string" ? c.fecha : "",
    visitaIds: Array.isArray(c.visitaIds) ? c.visitaIds : [],
    firmantes: Array.isArray(c.firmantes) ? c.firmantes : [],
    secciones: c.secciones,
  };
}

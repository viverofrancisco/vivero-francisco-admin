import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireStaff } from "@/lib/auth-helpers";
import { listDefaultFirmantes } from "@/lib/services/firmante.service";
import {
  InformeWizard,
  type EstadoInicialInforme,
} from "@/components/informes/informe-wizard";
import { hoyISOEcuador } from "@/lib/fechas";

export default async function NuevoInformePage({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string }>;
}) {
  await requireStaff();
  await requireAuth();
  const defaults = await listDefaultFirmantes();
  // Todo el catálogo activo: una sección puede ser de algo que no se hizo en
  // estas visitas —material entregado, un extra— y hasta ahora solo se podía
  // elegir entre los productos de las visitas o escribir el título a mano.
  const catalogo = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
  const defaultFirmantes = defaults.map((f) => ({
    nombre: f.nombre,
    cedula: f.cedula,
  }));
  // Retomar un borrador. El contenido se guardó tal como lo tenía el asistente,
  // así que se pasa como está; un borrador viejo con otra forma simplemente
  // arranca vacío en vez de romper la página.
  const { borrador: borradorId } = await searchParams;
  const borrador = borradorId
    ? await prisma.informeBorrador.findUnique({
        where: { id: borradorId },
        select: { id: true, numero: true, contenido: true, informeId: true },
      })
    : null;

  // Un borrador de una **edición** no se retoma acá: se vuelve a la edición del
  // informe del que salió, o se terminaría creando un duplicado del que se
  // quería corregir.
  if (borrador?.informeId) {
    redirect(
      `/dashboard/informes/${borrador.informeId}/editar?borrador=${borrador.id}`
    );
  }

  return (
    <InformeWizard
      defaultFirmantes={defaultFirmantes}
      catalogo={catalogo}
      inicial={contenidoValido(borrador?.contenido)}
      borradorId={borrador?.id}
      numeroDeBorrador={borrador?.numero}
    />
  );
}

/** Un borrador guardado con otra forma no puede voltear la pantalla. */
function contenidoValido(contenido: unknown): EstadoInicialInforme | undefined {
  if (!contenido || typeof contenido !== "object") return undefined;
  const c = contenido as Partial<EstadoInicialInforme>;
  if (!Array.isArray(c.secciones) || typeof c.titulo !== "string") {
    return undefined;
  }
  return {
    paso: typeof c.paso === "number" ? c.paso : undefined,
    clienteId: c.clienteId ?? null,
    rango: c.rango,
    titulo: c.titulo,
    fecha: typeof c.fecha === "string" ? c.fecha : hoyISOEcuador(),
    visitaIds: Array.isArray(c.visitaIds) ? c.visitaIds : [],
    firmantes: Array.isArray(c.firmantes) ? c.firmantes : [],
    secciones: c.secciones,
  };
}

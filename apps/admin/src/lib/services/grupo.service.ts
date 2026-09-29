import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import type { ResultadoEnLote } from "./lote";
import { isAdminRole } from "./viewer";

/**
 * Las cuadrillas: quiénes trabajan juntos.
 *
 * Un grupo dice con quién sale cada uno habitualmente; **no** dice quién fue a
 * una visita —eso es la asignación, que se elige al agendar y es la que cuenta
 * para todo lo que suma horas y tareas—. Por eso acá no hay nada de visitas.
 *
 * Estaba suelto adentro de las rutas web, con la autorización reducida a "hay
 * sesión": cualquiera con cuenta podía crear o archivar una cuadrilla. Ahora
 * leer es de cualquiera menos el cliente y escribir es de ADMIN/STAFF.
 */
export interface DatosDeGrupo {
  nombre: string;
  descripcion?: string | null;
  /** Reemplaza a los miembros actuales: lo que llega **es** la cuadrilla. */
  miembrosIds: string[];
}

const GRUPO_INCLUDE = {
  // Cuántas visitas lleva: es lo que distingue una cuadrilla de otra en la
  // lista, y lo muestran las dos aplicaciones.
  _count: { select: { visitas: true } },
  miembros: {
    include: {
      personal: { select: { id: true, nombre: true, apellido: true, tipo: true } },
    },
  },
} as const;

function ensureOficina(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

function ensurePuedeVer(viewer: Viewer) {
  if (viewer.role === "CLIENTE") throw new ForbiddenError();
}

export async function listGrupos(viewer: Viewer) {
  ensurePuedeVer(viewer);
  return prisma.grupo.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: GRUPO_INCLUDE,
  });
}

export async function getGrupo(viewer: Viewer, id: string) {
  ensurePuedeVer(viewer);
  const grupo = await prisma.grupo.findFirst({
    where: { id, deletedAt: null },
    include: GRUPO_INCLUDE,
  });
  if (!grupo) throw new NotFoundError("Grupo no encontrado");
  return grupo;
}

export async function crearGrupo(viewer: Viewer, datos: DatosDeGrupo) {
  ensureOficina(viewer);
  const id = await prisma.$transaction(async (tx) => {
    const creado = await tx.grupo.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        createdById: viewer.id,
        updatedById: viewer.id,
      },
    });
    await ponerMiembros(tx, creado.id, datos.miembrosIds);
    return creado.id;
  });
  return getGrupo(viewer, id);
}

export async function actualizarGrupo(
  viewer: Viewer,
  id: string,
  datos: DatosDeGrupo
) {
  ensureOficina(viewer);
  const existe = await prisma.grupo.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existe) throw new NotFoundError("Grupo no encontrado");

  await prisma.$transaction(async (tx) => {
    await tx.grupo.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        updatedById: viewer.id,
      },
    });
    // Los miembros se reemplazan enteros: el formulario manda la cuadrilla
    // completa, así que agregar sobre lo que había dejaría adentro al que
    // alguien acaba de sacar.
    await tx.grupoMiembro.deleteMany({ where: { grupoId: id } });
    await ponerMiembros(tx, id, datos.miembrosIds);
  });

  return getGrupo(viewer, id);
}

/**
 * En qué cuadrillas está una persona, dicho desde **su** ficha: lo que llega
 * es la lista entera, así que sale de las que no están y entra en las que
 * faltan. Es el espejo de `actualizarGrupo`, que reemplaza a los miembros de
 * un grupo; acá se reemplazan los grupos de un miembro. Hasta ahora había
 * que abrir cada grupo para cambiar a una persona de cuadrilla.
 */
export async function setGruposDePersonal(
  viewer: Viewer,
  personalId: string,
  grupoIds: string[]
): Promise<{ id: string; nombre: string }[]> {
  ensureOficina(viewer);
  const persona = await prisma.personal.findFirst({
    where: { id: personalId, deletedAt: null },
    select: { id: true },
  });
  if (!persona) throw new NotFoundError("Personal no encontrado");
  const unicos = [...new Set(grupoIds)];
  const vivos = await prisma.grupo.findMany({
    where: { id: { in: unicos }, deletedAt: null },
    select: { id: true },
  });
  if (vivos.length !== unicos.length) throw new NotFoundError("Grupo no encontrado");
  await prisma.$transaction(async (tx) => {
    await tx.grupoMiembro.deleteMany({ where: { personalId } });
    if (unicos.length > 0) {
      await tx.grupoMiembro.createMany({
        data: unicos.map((grupoId) => ({ personalId, grupoId })),
      });
    }
  });
  const grupos = await prisma.grupo.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  return grupos;
}

/**
 * Archivar la cuadrilla.
 *
 * Es soft delete y no puede ser otra cosa: las visitas que salieron con ella
 * guardan su `grupoId`, y borrarla de verdad dejaría a esas visitas diciendo
 * que salió un grupo que no existe.
 */
export async function archivarGrupo(viewer: Viewer, id: string) {
  ensureOficina(viewer);
  const existe = await prisma.grupo.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existe) throw new NotFoundError("Grupo no encontrado");
  await prisma.grupo.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: viewer.id },
  });
}

/**
 * Archivar de a varias. Una por una y no un `updateMany`, por lo mismo que en
 * personal: que una falle no cancela a las demás, y la respuesta nombra a las
 * que se quedaron. Ver `archivarVariosPersonal`.
 */
export async function archivarVariosGrupos(
  viewer: Viewer,
  ids: string[]
): Promise<ResultadoEnLote> {
  ensureOficina(viewer);
  const unicos = [...new Set(ids)];
  const nombres = new Map(
    (
      await prisma.grupo.findMany({
        where: { id: { in: unicos } },
        select: { id: true, nombre: true },
      })
    ).map((g) => [g.id, g.nombre])
  );

  let eliminados = 0;
  const errores: ResultadoEnLote["errores"] = [];
  for (const id of unicos) {
    try {
      await archivarGrupo(viewer, id);
      eliminados++;
    } catch (error) {
      errores.push({
        id,
        nombre: nombres.get(id) ?? null,
        motivo: error instanceof Error ? error.message : "No se pudo eliminar.",
      });
    }
  }
  return { eliminados, errores };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ponerMiembros(tx: Tx, grupoId: string, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  await tx.grupoMiembro.createMany({
    data: unicos.map((personalId) => ({ personalId, grupoId })),
  });
}

import { prisma } from "@/lib/prisma";
import { publicUrlForKey } from "@/lib/s3";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isAdminRole, type Viewer } from "./viewer";

/**
 * Qué le pareció al cliente.
 *
 * Reemplaza al chat de la visita. El chat pedía que alguien estuviera del otro
 * lado —alguien de la oficina mirando una bandeja— y en la práctica no lo usó
 * nadie. Esto pide una sola cosa, en el único momento en que el cliente tiene
 * algo que decir: cuando el trabajo terminó.
 *
 * **La califica el cliente, y solo cuando está completada.** Antes de eso no
 * hay nada que calificar; una visita incompleta o cancelada tampoco se
 * califica, porque lo que se juzga es el trabajo hecho y ahí no lo hubo.
 *
 * **La leen solo `ADMIN` y `STAFF`** —y el propio cliente, la suya—. Al
 * jardinero no le llega: una mala calificación se conversa, no se lee sola en
 * un teléfono.
 */

export const ESTRELLAS_MIN = 1;
export const ESTRELLAS_MAX = 5;

export interface CalificacionInput {
  estrellas: number;
  comentario?: string | null;
  /** Fotos ya subidas a R2; acá se confirman. */
  fotos?: { key: string }[];
}

const SELECT_CALIFICACION = {
  id: true,
  estrellas: true,
  comentario: true,
  createdAt: true,
  updatedAt: true,
  fotos: {
    select: { id: true, url: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

/** La visita, con lo poco que hace falta para decidir quién puede qué. */
async function visitaParaCalificar(visitaId: string) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: {
      id: true,
      estado: true,
      clienteId: true,
      cliente: { select: { userId: true } },
    },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");
  return visita;
}

/**
 * La calificación de una visita, o `null` si no la hay.
 *
 * La ve la oficina y el cliente dueño de la visita. El jardinero asignado no,
 * aunque la visita sea suya: no es él quien decide qué hacer con una queja.
 */
export async function getCalificacion(visitaId: string, viewer: Viewer) {
  const visita = await visitaParaCalificar(visitaId);
  const esSuya = viewer.clienteId !== null && viewer.clienteId === visita.clienteId;
  if (!isAdminRole(viewer.role) && !esSuya) throw new ForbiddenError();

  return prisma.calificacionVisita.findUnique({
    where: { visitaId },
    select: SELECT_CALIFICACION,
  });
}

/**
 * Guarda la calificación del cliente. Una por visita, y se puede cambiar.
 *
 * Cambiarla es normal: es su opinión, y cambiar de opinión sobre un jardín pasa
 * —vuelve al día siguiente y ve algo que no había visto—. Las fotos se
 * **reemplazan** por las que lleguen, igual que las tareas de un parte: lo que
 * manda el formulario es el estado final, y sumar dejaría sin forma de sacar
 * una foto cargada por error.
 */
export async function guardarCalificacion(
  visitaId: string,
  viewer: Viewer,
  datos: CalificacionInput
) {
  const visita = await visitaParaCalificar(visitaId);

  // Solo el dueño. La oficina no califica por el cliente: una calificación que
  // escribió el vivero sobre sí mismo no es una calificación.
  if (viewer.clienteId === null || viewer.clienteId !== visita.clienteId) {
    throw new ForbiddenError("Solo el cliente de la visita puede calificarla.");
  }
  if (visita.estado !== "COMPLETADA") {
    throw new ValidationError("Esta visita todavía no está completada.");
  }

  const estrellas = Math.round(datos.estrellas);
  if (estrellas < ESTRELLAS_MIN || estrellas > ESTRELLAS_MAX) {
    throw new ValidationError(
      `Las estrellas van de ${ESTRELLAS_MIN} a ${ESTRELLAS_MAX}.`
    );
  }
  const comentario = datos.comentario?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const calificacion = await tx.calificacionVisita.upsert({
      where: { visitaId },
      create: { visitaId, estrellas, comentario },
      update: { estrellas, comentario },
      select: { id: true },
    });

    if (datos.fotos) {
      await tx.calificacionVisitaFoto.deleteMany({
        where: { calificacionId: calificacion.id },
      });
      if (datos.fotos.length > 0) {
        await tx.calificacionVisitaFoto.createMany({
          data: datos.fotos.map((f) => ({
            calificacionId: calificacion.id,
            key: f.key,
            url: publicUrlForKey(f.key),
          })),
        });
      }
    }

    return tx.calificacionVisita.findUniqueOrThrow({
      where: { id: calificacion.id },
      select: SELECT_CALIFICACION,
    });
  });
}

/**
 * El promedio de un cliente, para su ficha.
 *
 * Con el total al lado siempre: "5 estrellas" de una visita y "4,6" de treinta
 * no son lo mismo, y un promedio solo no deja distinguirlos.
 */
export async function promedioDeCliente(clienteId: string, viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
  const r = await prisma.calificacionVisita.aggregate({
    where: { visita: { clienteId, deletedAt: null } },
    _avg: { estrellas: true },
    _count: true,
  });
  return { promedio: r._avg.estrellas, total: r._count };
}

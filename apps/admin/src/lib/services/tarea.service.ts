import { Prisma, type OrdenTareas } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole, isPersonalRole } from "./viewer";

/**
 * El catálogo de tareas de jardinería.
 *
 * Lo mantiene el admin y lo usa todo el mundo: es de dónde salen las casillas
 * que el jardinero marca al cerrar una visita, y de dónde se eligen las tareas
 * obligatorias al agendarla.
 *
 * **Nada de esto lleva plata.** Ver el comentario del modelo `Tarea`: una tarea
 * es trabajo hecho, no algo que se venda.
 */

export const TAREA_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  orden: true,
} as const;

export interface TareaListada {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

/**
 * Escribir el catálogo es de oficina.
 *
 * Un jardinero marca tareas, no las inventa: si cada uno pudiera agregar la
 * suya, en un mes habría "poda de setos", "Poda setos" y "podar setos", que es
 * justamente el desorden que la tabla viene a evitar.
 */
function ensureAdmin(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

/**
 * Leerlo lo puede hacer quien trabaja las visitas.
 *
 * El personal necesita la lista para marcar lo que hizo, así que no alcanza con
 * ADMIN/STAFF. El cliente no: lo que él ve son las tareas **de su visita**, que
 * le llegan por la visita misma y no por el catálogo entero.
 */
function ensureCanRead(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && !isPersonalRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

/**
 * Nombres repetidos los atrapa el índice único parcial, no una consulta previa:
 * entre un `findFirst` y el `create` hay lugar para que otra pestaña gane la
 * carrera, y la base es la única que no se equivoca.
 *
 * Es **parcial** (`WHERE "deletedAt" IS NULL`), así que choca solo contra las
 * tareas vivas: el nombre de una eliminada queda libre para volver a usarse.
 */
async function conNombreUnico<T>(fn: () => Promise<T>, nombre: string) {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(`Ya existe una tarea llamada "${nombre}".`);
    }
    throw error;
  }
}

function limpiarNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (!limpio) throw new ValidationError("El nombre de la tarea es obligatorio.");
  return limpio;
}

/**
 * Cómo está ordenado el catálogo hoy.
 *
 * Vive en la fila de configuración y no en la URL de la pantalla, porque el
 * orden es el mismo para todos: es el que el jardinero ve en las casillas al
 * cerrar una visita. Si no existe la fila —base recién creada— vale el default.
 */
export async function getOrdenTareas(): Promise<OrdenTareas> {
  const config = await prisma.empresaConfig.findUnique({
    where: { id: "default" },
    select: { tareasOrden: true },
  });
  return config?.tareasOrden ?? "PERSONALIZADO";
}

const ORDEN_PRISMA: Record<
  OrdenTareas,
  Prisma.TareaOrderByWithRelationInput[]
> = {
  // `nombre` de desempate: dos tareas con el mismo número saldrían en un orden
  // que cambia entre consultas, y una lista que se reacomoda sola al recargar
  // parece un error aunque no lo sea.
  PERSONALIZADO: [{ orden: "asc" }, { nombre: "asc" }],
  ALFABETICO_AZ: [{ nombre: "asc" }],
  ALFABETICO_ZA: [{ nombre: "desc" }],
};

/** Las tareas vivas, en el orden configurado. */
export async function listTareas(viewer: Viewer): Promise<TareaListada[]> {
  ensureCanRead(viewer);
  return prisma.tarea.findMany({
    where: { deletedAt: null },
    orderBy: ORDEN_PRISMA[await getOrdenTareas()],
    select: TAREA_SELECT,
  });
}

/**
 * Cambia cómo se ordena el catálogo.
 *
 * Pasar a alfabético **no toca `Tarea.orden`**: el acomodo a mano queda
 * guardado y volver a "Personalizado" lo recupera tal cual estaba. Renumerar al
 * cambiar de modo destruiría el trabajo de arrastrar diecisiete filas con un
 * clic en un desplegable.
 */
export async function setOrdenTareas(viewer: Viewer, modo: OrdenTareas) {
  ensureAdmin(viewer);
  await prisma.empresaConfig.upsert({
    where: { id: "default" },
    create: { id: "default", tareasOrden: modo },
    update: { tareasOrden: modo },
  });
}

export interface TareaInput {
  nombre: string;
  descripcion?: string | null;
}

/**
 * Crea una tarea al final de la lista.
 *
 * El `orden` no se recibe: va al final, de a diez, y reordenar es otra acción.
 * Pedirle a quien escribe "Poda de bambú" que además elija un número es pedirle
 * que sepa cómo está numerado el resto.
 */
export async function createTarea(viewer: Viewer, input: TareaInput) {
  ensureAdmin(viewer);
  const nombre = limpiarNombre(input.nombre);

  const ultima = await prisma.tarea.findFirst({
    where: { deletedAt: null },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  return conNombreUnico(
    () =>
      prisma.tarea.create({
        data: {
          nombre,
          descripcion: input.descripcion?.trim() || null,
          orden: (ultima?.orden ?? 0) + 10,
          createdById: viewer.id,
          updatedById: viewer.id,
        },
        select: TAREA_SELECT,
      }),
    nombre
  );
}

/**
 * Renombrar una tarea **reescribe lo que ya pasó**, y está bien que así sea.
 *
 * Las visitas apuntan a la tarea por id, no guardan una copia del nombre, así
 * que corregir "Fertilzación foliar" arregla de una vez las cincuenta visitas
 * que la tenían mal escrita. Es lo contrario de lo que hace `Factura`, donde el
 * nombre va congelado: ahí el documento ya se emitió y no puede cambiar. Un
 * informe sí se corrige emitiendo una versión nueva.
 *
 * Si lo que se quiere es otra cosa —no corregir el nombre sino reemplazar la
 * tarea— eso es eliminar una y crear otra, y entonces cada visita conserva la
 * que realmente se hizo.
 */
export async function updateTarea(
  viewer: Viewer,
  id: string,
  input: Partial<TareaInput>
) {
  ensureAdmin(viewer);
  const existente = await prisma.tarea.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, nombre: true },
  });
  if (!existente) throw new NotFoundError("Tarea no encontrada");

  const nombre =
    input.nombre !== undefined ? limpiarNombre(input.nombre) : existente.nombre;

  return conNombreUnico(
    () =>
      prisma.tarea.update({
        where: { id },
        data: {
          ...(input.nombre !== undefined ? { nombre } : {}),
          ...(input.descripcion !== undefined
            ? { descripcion: input.descripcion?.trim() || null }
            : {}),
          updatedById: viewer.id,
        },
        select: TAREA_SELECT,
      }),
    nombre
  );
}

/**
 * Eliminar una tarea la saca de las listas, no del historial.
 *
 * Nunca es un borrado duro: las visitas donde se hizo la siguen nombrando, y
 * esos informes ya se imprimieron y el cliente los tiene. Por eso tampoco hace
 * falta preguntar "¿está en uso?" antes de eliminar — que lo esté es
 * exactamente el caso que el borrado en blando resuelve.
 */
export async function softDeleteTarea(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  const existente = await prisma.tarea.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existente) throw new NotFoundError("Tarea no encontrada");

  await prisma.tarea.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: viewer.id,
      deletedByNombre: viewer.nombre,
    },
  });
}

/**
 * Renumera el catálogo entero con el orden recibido.
 *
 * Recibe **todos** los ids y no "subí este uno": mover una fila es intercambiar
 * dos números, y hacerlo de a un extremo deja la lista con dos tareas en el
 * mismo lugar si dos pestañas mueven a la vez. Se reescribe la lista completa,
 * de a diez, y el resultado no depende de en qué estado estaba.
 *
 * Lo que no esté en `ids` se queda como está: no es una eliminación encubierta.
 */
export async function reordenarTareas(viewer: Viewer, ids: string[]) {
  ensureAdmin(viewer);
  if (ids.length === 0) return;

  const vivas = await prisma.tarea.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  if (vivas.length !== ids.length) {
    throw new ValidationError("Alguna de las tareas ya no existe.");
  }

  await prisma.$transaction([
    ...ids.map((id, idx) =>
      prisma.tarea.update({
        where: { id },
        data: { orden: (idx + 1) * 10, updatedById: viewer.id },
      })
    ),
    // Arrastrar **es** elegir el orden personalizado. Guardar las posiciones y
    // seguir mostrando la lista alfabética dejaría el acomodo invisible, y
    // quien arrastró vería la fila volver a su lugar.
    prisma.empresaConfig.upsert({
      where: { id: "default" },
      create: { id: "default", tareasOrden: "PERSONALIZADO" },
      update: { tareasOrden: "PERSONALIZADO" },
    }),
  ]);
}

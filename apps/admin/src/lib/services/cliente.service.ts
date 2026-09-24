import { prisma } from "@/lib/prisma";
import { filtroClientePorTexto } from "./busqueda";
import { ForbiddenError, NotFoundError, ValidationError, ServiceError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";
import { clienteImportRowSchema } from "@/lib/validations/cliente";
import { nombreCliente } from "@vivero/shared";

/**
 * Lo que se muestra de una propiedad donde sea que aparezca.
 *
 * La dirección era del cliente y se mudó acá; el sector vino con ella, porque
 * es geográfico y es del lugar, no de la persona.
 */
export const PROPIEDAD_SELECT = {
  id: true,
  nombre: true,
  ciudad: true,
  direccion: true,
  numeroCasa: true,
  referencia: true,
  notas: true,
  lat: true,
  lng: true,
  m2Total: true,
  jardinerasPlantaAlta: true,
  numeroArboles: true,
  mlVegetacionBaja: true,
  mlVegetacionMedia: true,
  mlVegetacionAlta: true,
  m2Cesped: true,
  sector: { select: { id: true, nombre: true } },
} as const;

/** Las vivas de un cliente, en el orden en que se cargaron. */
export const PROPIEDADES_DEL_CLIENTE = {
  where: { deletedAt: null },
  select: PROPIEDAD_SELECT,
  orderBy: { createdAt: "asc" },
} as const;

export async function getClienteProfile(viewer: Viewer) {
  if (viewer.role !== "CLIENTE") {
    throw new ForbiddenError();
  }
  if (!viewer.clienteId) {
    throw new NotFoundError("Tu cuenta no está vinculada a un cliente.");
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: viewer.clienteId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      telefono: true,
      propiedades: PROPIEDADES_DEL_CLIENTE,
    },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  const proximaVisita = await prisma.visita.findFirst({
    where: {
      deletedAt: null,
      estado: "PROGRAMADA",
      fechaProgramada: { gte: startOfToday() },
      clienteId: cliente.id,
    },
    orderBy: { fechaProgramada: "asc" },
    select: {
      id: true,
      fechaProgramada: true,
      horaEntrada: true,
      // Lo que se va a hacer, en la medida en que se sabe: las tareas exigidas.
      // Lo que se hizo de verdad solo existe después, cuando cada jardinero
      // carga su parte.
      tareasObligatorias: {
        select: { tarea: { select: { id: true, nombre: true } } },
      },
    },
  });

  return { cliente, proximaVisita };
}

// ──────────────────────────────────────────────
// Staff-side cliente list / detail
// ──────────────────────────────────────────────

const CLIENTE_LIST_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  empresa: true,
  telefono: true,
  inactivoDesde: true,
  // La lista muestra dónde está: con una propiedad, la suya; con varias, la
  // primera y cuántas más. Contarlas de a una es lo que evita que la fila
  // mienta cuando alguien tiene casa en dos sectores.
  propiedades: PROPIEDADES_DEL_CLIENTE,
} as const;

async function buildClienteWhereForStaff(viewer: Viewer) {
  if (isAdminRole(viewer.role)) return { deletedAt: null };
  throw new ForbiddenError();
}

export interface ListClientesFilters {
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listClientes(
  viewer: Viewer,
  filters: ListClientesFilters = {}
) {
  const where = await buildClienteWhereForStaff(viewer);
  // Palabra por palabra: la frase entera contra cada campo no encontraba a
  // nadie por "nombre apellido", que es como se busca a una persona. El
  // teléfono entra en la misma pregunta (ver `filtroClientePorTexto`).
  const porTexto = filtroClientePorTexto(filters.search, (palabra) => [
    { telefono: { contains: palabra } },
  ]);
  if (porTexto) Object.assign(where, porTexto);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const items = await prisma.cliente.findMany({
    where,
    select: CLIENTE_LIST_SELECT,
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  return {
    items: slice,
    nextCursor: hasMore ? slice[slice.length - 1].id : null,
  };
}

export async function getClienteForStaff(clienteId: string, viewer: Viewer) {
  const baseWhere = await buildClienteWhereForStaff(viewer);
  const cliente = await prisma.cliente.findFirst({
    where: { ...baseWhere, id: clienteId },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      email: true,
      telefono: true,
      notas: true,
      inactivoDesde: true,
      propiedades: PROPIEDADES_DEL_CLIENTE,
      suscripciones: {
        where: { estado: { not: "CANCELADO" } },
        select: {
          id: true,
          estado: true,
          periodicidad: true,
          fechaInicio: true,
          items: {
            select: {
              id: true,
              precio: true,
              ivaTasa: true,
              visitasPorPeriodo: true,
              producto: {
                select: { id: true, nombre: true, tipo: true },
              },
            },
          },
        },
      },
    },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  return cliente;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ──────────────────────────────────────────────
// Create / update
// ──────────────────────────────────────────────

/** Lo que hay que mantener en un lugar. Todo opcional: se mide después. */
export interface DatosDePropiedad {
  nombre?: string | null;
  ciudad?: string | null;
  sectorId?: string | null;
  direccion?: string | null;
  numeroCasa?: string | null;
  referencia?: string | null;
  notas?: string | null;
  lat?: number | null;
  lng?: number | null;
  m2Total?: number | null;
  jardinerasPlantaAlta?: boolean;
  numeroArboles?: number | null;
  mlVegetacionBaja?: number | null;
  mlVegetacionMedia?: number | null;
  mlVegetacionAlta?: number | null;
  m2Cesped?: number | null;
}

export interface CreateClientePayload {
  nombre?: string | null;
  apellido?: string | null;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  notas?: string | null;
  /** La primera, creada con él. Ver `createCliente`. */
  propiedad?: DatosDePropiedad;
}

function ensureCanWrite(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

export interface AsignarServicioPayload {
  productoId: string;
  precio: number;
  iva?: number;
  visitasPorPeriodo?: number | null;
  fechaInicio: string;
  notas?: string | null;
}

export async function createCliente(
  viewer: Viewer,
  payload: CreateClientePayload
) {
  ensureCanWrite(viewer);

  if (!payload.nombre?.trim() && !payload.empresa?.trim()) {
    throw new ValidationError("Se requiere un nombre o una empresa.");
  }

  return prisma.cliente.create({
    data: {
      nombre: payload.nombre ?? "",
      apellido: payload.apellido ?? null,
      empresa: payload.empresa ?? null,
      email: payload.email ?? null,
      telefono: payload.telefono ?? null,
      notas: payload.notas ?? null,
      createdById: viewer.id,
      updatedById: viewer.id,
      // Un cliente nace con una propiedad, en la misma transacción.
      //
      // Sin ningún lugar donde trabajar no sirve para agendar, y cargarlo en
      // dos pasos es garantizar que alguien se olvide del segundo — lo mismo
      // que pasaba con la cuenta del jardinero antes de que naciera con su
      // ficha. Si el formulario no mandó nada, la propiedad sale vacía y con
      // el nombre que nadie va a tener que inventar.
      propiedades: {
        create: {
          nombre: payload.propiedad?.nombre?.trim() || "Principal",
          ciudad: payload.propiedad?.ciudad ?? null,
          sectorId: payload.propiedad?.sectorId ?? null,
          direccion: payload.propiedad?.direccion ?? null,
          numeroCasa: payload.propiedad?.numeroCasa ?? null,
          referencia: payload.propiedad?.referencia ?? null,
          notas: payload.propiedad?.notas ?? null,
          lat: payload.propiedad?.lat ?? null,
          lng: payload.propiedad?.lng ?? null,
          m2Total: payload.propiedad?.m2Total ?? null,
          jardinerasPlantaAlta: payload.propiedad?.jardinerasPlantaAlta ?? false,
          numeroArboles: payload.propiedad?.numeroArboles ?? null,
          mlVegetacionBaja: payload.propiedad?.mlVegetacionBaja ?? null,
          mlVegetacionMedia: payload.propiedad?.mlVegetacionMedia ?? null,
          mlVegetacionAlta: payload.propiedad?.mlVegetacionAlta ?? null,
          m2Cesped: payload.propiedad?.m2Cesped ?? null,
          createdById: viewer.id,
          updatedById: viewer.id,
        },
      },
    },
    select: { id: true },
  });
}

// ──────────────────────────────────────────────
// Importación masiva (CSV)
// ──────────────────────────────────────────────

export interface ImportRowResult {
  fila: number; // 1-based, sin contar la cabecera
  estado: "creado" | "omitido" | "error";
  nombre?: string;
  clienteId?: string;
  mensaje?: string;
}

export interface ImportClientesResult {
  created: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
}

const MAX_IMPORT_ROWS = 1000;

/**
 * Crea clientes en lote desde filas de un CSV. Valida cada fila, omite
 * duplicados por correo (contra la DB y dentro del archivo) y por teléfono
 * (solo contra la DB; el teléfono puede repetirse entre clientes nuevos), y
 * reporta el resultado por fila. Un fallo de fila no aborta el resto.
 */
export async function importClientes(
  viewer: Viewer,
  rows: Record<string, unknown>[]
): Promise<ImportClientesResult> {
  ensureCanWrite(viewer);

  if (rows.length === 0) {
    throw new ValidationError("El archivo no tiene filas.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(
      `Máximo ${MAX_IMPORT_ROWS} filas por importación (recibidas ${rows.length}).`
    );
  }

  // Contactos ya existentes para detectar duplicados.
  const existentes = await prisma.cliente.findMany({
    where: { deletedAt: null },
    select: { email: true, telefono: true },
  });
  // El correo identifica al cliente (login), así que se de-duplica contra la DB
  // y dentro del archivo. El teléfono puede repetirse entre clientes (p. ej. un
  // mismo contacto administra varias cuentas), así que solo se de-duplica contra
  // la DB —red de seguridad ante una reimportación—, no dentro del archivo.
  const seenEmails = new Set<string>();
  const dbPhones = new Set<string>();
  for (const c of existentes) {
    if (c.email) seenEmails.add(c.email.toLowerCase());
    if (c.telefono) dbPhones.add(formatForWhatsApp(c.telefono));
  }

  const results: ImportRowResult[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 1;
    const parsed = clienteImportRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      failed++;
      results.push({
        fila,
        estado: "error",
        mensaje: parsed.error.issues[0]?.message ?? "Datos inválidos",
      });
      continue;
    }

    const data = parsed.data;
    const emailKey = data.email ? data.email.toLowerCase() : null;
    const phoneKey = data.telefono ? formatForWhatsApp(data.telefono) : null;

    if (
      (emailKey && seenEmails.has(emailKey)) ||
      (phoneKey && dbPhones.has(phoneKey))
    ) {
      skipped++;
      results.push({
        fila,
        estado: "omitido",
        nombre: nombreCliente(data),
        mensaje: "Ya existe un cliente con ese correo o teléfono.",
      });
      continue;
    }

    try {
      const cliente = await createCliente(viewer, {
        nombre: data.nombre,
        apellido: data.apellido,
        empresa: data.empresa,
        email: data.email,
        telefono: data.telefono,
        notas: data.notas,
        // Las columnas de dirección del CSV describen su primera propiedad.
        propiedad: {
          ciudad: data.ciudad,
          direccion: data.direccion,
          numeroCasa: data.numeroCasa,
          referencia: data.referencia,
          m2Total: data.metrosCuadrados,
        },
      });
      created++;
      if (emailKey) seenEmails.add(emailKey);
      results.push({ fila, estado: "creado", nombre: nombreCliente(data), clienteId: cliente.id });
    } catch (e) {
      failed++;
      results.push({
        fila,
        estado: "error",
        nombre: nombreCliente(data),
        mensaje: e instanceof ServiceError ? e.message : "No se pudo crear el cliente.",
      });
    }
  }

  return { created, skipped, failed, results };
}

export async function updateCliente(
  clienteId: string,
  viewer: Viewer,
  payload: Partial<CreateClientePayload>
) {
  ensureCanWrite(viewer);

  // Make sure the viewer can already see this cliente (sector check).
  await getClienteForStaff(clienteId, viewer);

  try {
    return await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        ...(payload.nombre !== undefined ? { nombre: payload.nombre ?? "" } : {}),
        ...(payload.apellido !== undefined ? { apellido: payload.apellido } : {}),
        ...(payload.empresa !== undefined ? { empresa: payload.empresa } : {}),
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.telefono !== undefined ? { telefono: payload.telefono } : {}),
        ...(payload.notas !== undefined ? { notas: payload.notas } : {}),
        updatedById: viewer.id,
      },
    });
  } catch {
    throw new NotFoundError("Cliente no encontrado");
  }
}

/**
 * Marcar un cliente como inactivo, o reactivarlo.
 *
 * Es distinto de archivar: el inactivo sigue en las listas y en su ficha con
 * todo su historial, lo que cambia es que **no se le agendan visitas**
 * (`createVisitasBatch` lo rechaza) y los selectores lo muestran atenuado.
 * Es para el que dejó de contratar pero puede volver, que es lo más común.
 */
export async function marcarClienteInactivo(
  viewer: Viewer,
  clienteId: string,
  inactivo: boolean
) {
  ensureCanWrite(viewer);
  await getClienteForStaff(clienteId, viewer);
  return prisma.cliente.update({
    where: { id: clienteId },
    data: { inactivoDesde: inactivo ? new Date() : null, updatedById: viewer.id },
    select: { id: true, inactivoDesde: true },
  });
}

// ──────────────────────────────────────────────
// Borrado (soft / bulk / hard)
// ──────────────────────────────────────────────

/** Soft delete de un cliente (archivar). Respeta el scoping por sector. */
export async function deleteCliente(viewer: Viewer, clienteId: string) {
  ensureCanWrite(viewer);
  await getClienteForStaff(clienteId, viewer); // existencia + sector
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { deletedAt: new Date() },
  });
}

/** Soft delete en lote (archivar). Solo afecta clientes activos. */
export async function bulkSoftDeleteClientes(
  viewer: Viewer,
  ids: string[]
): Promise<{ count: number }> {
  ensureCanWrite(viewer);
  if (ids.length === 0) return { count: 0 };
  const where = await buildClienteWhereForStaff(viewer);
  const res = await prisma.cliente.updateMany({
    where: { ...where, id: { in: ids } },
    data: { deletedAt: new Date() },
  });
  return { count: res.count };
}

/** Hard delete (permanente). Solo ADMIN. Borra la ficha (cascada a servicios,
 * visitas, media, informes, tokens) y la cuenta de login del cliente (cascada a
 * Account/Session/RefreshToken/PushToken). La protección por entorno la hace la
 * ruta. */
export async function hardDeleteClientes(
  viewer: Viewer,
  ids: string[]
): Promise<{ count: number }> {
  if (viewer.role !== "ADMIN") {
    throw new ForbiddenError("Solo un administrador puede borrar permanentemente.");
  }
  if (ids.length === 0) return { count: 0 };

  return prisma.$transaction(async (tx) => {
    const clientes = await tx.cliente.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });
    if (clientes.length === 0) return { count: 0 };

    const clienteIds = clientes.map((c) => c.id);
    const userIds = clientes
      .map((c) => c.userId)
      .filter((u): u is string => !!u);

    await tx.cliente.deleteMany({ where: { id: { in: clienteIds } } });
    if (userIds.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
    return { count: clienteIds.length };
  });
}

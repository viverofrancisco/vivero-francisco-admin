/**
 * Datos de facturación de un cliente.
 *
 * Un mismo contacto puede facturar de más de una forma: a nombre propio y al de
 * su empresa, o a razones sociales distintas. Por eso son registros aparte del
 * Cliente y no campos sueltos: el nombre con el que se lo conoce en el portal
 * no tiene por qué ser la razón social del SRI.
 *
 * Los campos son exactamente los que Contífico guarda de una persona —
 * verificado contra su API: `cedula`/`ruc`, `razon_social`, `tipo` (N/J),
 * `direccion`, `telefonos`, `email`.
 */
import { prisma } from "@/lib/prisma";
import { esCedulaValida, esRucValido } from "@/lib/contifico/cedula";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

export interface DatoFacturacionInput {
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  esPredeterminado?: boolean;
  /** Crear sin ofrecerlo después: se usa una vez y no ensucia la ficha. */
  archivado?: boolean;
}

/**
 * Se valida acá y no al facturar.
 *
 * Contífico rechaza una cédula inválida con "Cedula Incorrecta" recién al
 * emitir el documento, que es el peor momento para descubrirlo: la orden ya
 * está confirmada y alguien está esperando la factura.
 */
function validar(payload: DatoFacturacionInput): void {
  const id = payload.identificacion.trim();
  if (!id) throw new ValidationError("La identificación es obligatoria.");
  if (payload.tipoIdentificacion === "RUC" && !esRucValido(id)) {
    throw new ValidationError("El RUC no es válido.");
  }
  if (payload.tipoIdentificacion === "CEDULA" && !esCedulaValida(id)) {
    throw new ValidationError("La cédula no es válida.");
  }
  if (!payload.razonSocial.trim()) {
    throw new ValidationError("La razón social es obligatoria.");
  }
}

/** Los que se pueden elegir al facturar. */
export async function listarDatosFacturacion(clienteId: string) {
  return prisma.datoFacturacion.findMany({
    where: { clienteId, archivado: false },
    orderBy: [{ esPredeterminado: "desc" }, { createdAt: "asc" }],
  });
}

export async function crearDatoFacturacion(
  viewer: Viewer,
  clienteId: string,
  payload: DatoFacturacionInput
) {
  ensureCanWrite(viewer);
  validar(payload);

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  const identificacion = payload.identificacion.trim();
  const existentes = await prisma.datoFacturacion.count({
    where: { clienteId, archivado: false },
  });
  // El primero es el predeterminado sin que nadie lo pida: si es el único, no
  // tiene sentido obligar a marcarlo.
  // Uno archivado nunca es el predeterminado: no se puede proponer algo que ni
  // siquiera se ofrece.
  const predeterminado = payload.archivado
    ? false
    : (payload.esPredeterminado ?? existentes === 0);

  try {
    return await prisma.$transaction(async (tx) => {
      if (predeterminado) {
        await tx.datoFacturacion.updateMany({
          where: { clienteId },
          data: { esPredeterminado: false },
        });
      }
      return tx.datoFacturacion.create({
        data: {
          clienteId,
          tipoIdentificacion: payload.tipoIdentificacion,
          identificacion,
          razonSocial: payload.razonSocial.trim(),
          tipoPersona: payload.tipoPersona,
          direccion: payload.direccion?.trim() || null,
          telefono: payload.telefono?.trim() || null,
          email: payload.email?.trim() || null,
          esPredeterminado: predeterminado,
          archivado: payload.archivado ?? false,
          createdById: viewer.id,
          updatedById: viewer.id,
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictError(
        `Este cliente ya tiene datos de facturación con la identificación ${identificacion}.`
      );
    }
    throw error;
  }
}

export async function actualizarDatoFacturacion(
  viewer: Viewer,
  id: string,
  payload: DatoFacturacionInput
) {
  ensureCanWrite(viewer);
  validar(payload);

  const actual = await prisma.datoFacturacion.findUnique({
    where: { id },
    select: { id: true, clienteId: true },
  });
  if (!actual) throw new NotFoundError("Datos de facturación no encontrados");

  return prisma.$transaction(async (tx) => {
    if (payload.esPredeterminado) {
      await tx.datoFacturacion.updateMany({
        where: { clienteId: actual.clienteId, id: { not: id } },
        data: { esPredeterminado: false },
      });
    }
    return tx.datoFacturacion.update({
      where: { id },
      data: {
        tipoIdentificacion: payload.tipoIdentificacion,
        identificacion: payload.identificacion.trim(),
        razonSocial: payload.razonSocial.trim(),
        tipoPersona: payload.tipoPersona,
        direccion: payload.direccion?.trim() || null,
        telefono: payload.telefono?.trim() || null,
        email: payload.email?.trim() || null,
        ...(payload.esPredeterminado !== undefined
          ? { esPredeterminado: payload.esPredeterminado }
          : {}),
        updatedById: viewer.id,
      },
    });
  });
}

/**
 * Archiva en vez de borrar: las facturas emitidas lo siguen citando, y perder
 * con qué datos se emitió una factura sería perder el rastro del papel.
 */
export async function archivarDatoFacturacion(viewer: Viewer, id: string) {
  ensureCanWrite(viewer);
  const dato = await prisma.datoFacturacion.findUnique({
    where: { id },
    select: { id: true, clienteId: true, esPredeterminado: true },
  });
  if (!dato) throw new NotFoundError("Datos de facturación no encontrados");

  return prisma.$transaction(async (tx) => {
    const archivado = await tx.datoFacturacion.update({
      where: { id },
      data: { archivado: true, esPredeterminado: false, updatedById: viewer.id },
    });
    // Si era el predeterminado, el más viejo que quede toma su lugar: dejar al
    // cliente sin ninguno haría que facturar pidiera elegir siempre.
    if (dato.esPredeterminado) {
      const siguiente = await tx.datoFacturacion.findFirst({
        where: { clienteId: dato.clienteId, archivado: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (siguiente) {
        await tx.datoFacturacion.update({
          where: { id: siguiente.id },
          data: { esPredeterminado: true },
        });
      }
    }
    return archivado;
  });
}

/**
 * Con qué datos emitir. Sin `datoId` se usa el predeterminado del cliente.
 *
 * Devuelve el registro completo; quien factura arma el snapshot desde ahí.
 */
export async function resolverDatoParaFacturar(
  clienteId: string,
  datoId?: string | null
) {
  if (datoId) {
    const dato = await prisma.datoFacturacion.findUnique({ where: { id: datoId } });
    if (!dato || dato.clienteId !== clienteId) {
      throw new ValidationError(
        "Esos datos de facturación no son de este cliente."
      );
    }
    return dato;
  }

  const predeterminado = await prisma.datoFacturacion.findFirst({
    where: { clienteId, archivado: false },
    orderBy: [{ esPredeterminado: "desc" }, { createdAt: "asc" }],
  });
  if (!predeterminado) {
    throw new ValidationError(
      "Este cliente no tiene datos de facturación cargados. Agregalos desde su ficha antes de emitir."
    );
  }
  return predeterminado;
}

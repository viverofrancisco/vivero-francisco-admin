/**
 * Los emisores: a nombre de qué RUC sale un comprobante electrónico.
 *
 * Es una tabla y no una configuración única porque el vivero factura con más de
 * un RUC y elige cuál al emitir. Para el SRI cada uno es un contribuyente
 * distinto: su propio certificado de firma, su propia numeración y su propio
 * trámite de habilitación de ambiente.
 *
 * **El certificado nunca sale de acá.** Se guarda cifrado y solo lo descifra
 * `certificadoParaFirmar()`, que usa el servicio de emisión. Ninguna función de
 * lectura lo devuelve, ni siquiera a un ADMIN: lo que la pantalla necesita
 * saber es si hay uno, a nombre de quién y hasta cuándo sirve.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AmbienteSri } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { ForbiddenError } from "./errors";
import type { Viewer } from "./viewer";
import { cifrar, descifrar, descifrarTexto } from "@/lib/sri/cifrado";
import { leerCertificado } from "@/lib/sri/certificado";

function ensureAdmin(viewer: Viewer): void {
  if (viewer.role !== "ADMIN") throw new ForbiddenError();
}

/** Lo que la pantalla puede ver de un emisor. Sin el certificado. */
const CAMPOS_VISIBLES = {
  id: true,
  ruc: true,
  razonSocial: true,
  nombreComercial: true,
  dirMatriz: true,
  direccionEstablecimiento: true,
  establecimiento: true,
  puntoEmision: true,
  obligadoContabilidad: true,
  contribuyenteEspecial: true,
  agenteRetencion: true,
  ambiente: true,
  certificadoSujeto: true,
  certificadoVence: true,
  activo: true,
  predeterminado: true,
} as const;

export interface EmisorInput {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  dirMatriz: string;
  direccionEstablecimiento: string;
  establecimiento: string;
  puntoEmision: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string | null;
  agenteRetencion?: string | null;
  ambiente: AmbienteSri;
  activo?: boolean;
  predeterminado?: boolean;
}

/**
 * El RUC ecuatoriano son 13 dígitos y termina en 001 (el establecimiento del
 * contribuyente). Se valida acá y no solo en el formulario porque un RUC mal
 * escrito no falla al guardar: falla recién cuando el SRI devuelve el
 * comprobante, con la factura ya armada.
 */
function limpiar(payload: EmisorInput) {
  const ruc = payload.ruc.trim();
  if (!/^\d{13}$/.test(ruc)) {
    throw new ValidationError("El RUC tiene que ser de 13 dígitos.");
  }
  const tres = (valor: string, campo: string) => {
    const v = valor.trim();
    if (!/^\d{3}$/.test(v)) {
      throw new ValidationError(`${campo} tiene que ser de 3 dígitos, como "001".`);
    }
    return v;
  };
  if (!payload.razonSocial.trim()) {
    throw new ValidationError("La razón social es obligatoria.");
  }
  return {
    ruc,
    razonSocial: payload.razonSocial.trim(),
    nombreComercial: payload.nombreComercial?.trim() || null,
    dirMatriz: payload.dirMatriz.trim(),
    direccionEstablecimiento: payload.direccionEstablecimiento.trim(),
    establecimiento: tres(payload.establecimiento, "El establecimiento"),
    puntoEmision: tres(payload.puntoEmision, "El punto de emisión"),
    obligadoContabilidad: payload.obligadoContabilidad,
    contribuyenteEspecial: payload.contribuyenteEspecial?.trim() || null,
    agenteRetencion: payload.agenteRetencion?.trim() || null,
    ambiente: payload.ambiente,
    activo: payload.activo ?? true,
  };
}

export async function listarEmisores(viewer: Viewer) {
  ensureAdmin(viewer);
  return prisma.emisor.findMany({
    orderBy: [{ predeterminado: "desc" }, { razonSocial: "asc" }],
    select: { ...CAMPOS_VISIBLES, _count: { select: { facturas: true } } },
  });
}

/** Los que se pueden elegir al emitir: activos y con certificado cargado. */
export async function emisoresDisponibles(viewer: Viewer) {
  ensureAdmin(viewer);
  return prisma.emisor.findMany({
    where: { activo: true, certificado: { not: null } },
    orderBy: [{ predeterminado: "desc" }, { razonSocial: "asc" }],
    select: CAMPOS_VISIBLES,
  });
}

/** Solo uno viene elegido al emitir: marcar uno desmarca al anterior. */
async function ordenarPredeterminado(tx: Prisma.TransactionClient, id: string) {
  await tx.emisor.updateMany({
    where: { id: { not: id }, predeterminado: true },
    data: { predeterminado: false },
  });
}

function comoConflicto(error: unknown, ruc: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictError(`Ya hay un emisor con el RUC ${ruc}.`);
  }
  throw error;
}

export async function crearEmisor(viewer: Viewer, payload: EmisorInput) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.$transaction(async (tx) => {
      // El primero es el predeterminado sin que nadie lo pida: con uno solo, la
      // elección no existe.
      const primero = (await tx.emisor.count()) === 0;
      const creado = await tx.emisor.create({
        data: {
          ...datos,
          predeterminado: payload.predeterminado || primero,
        },
        select: CAMPOS_VISIBLES,
      });
      if (creado.predeterminado) await ordenarPredeterminado(tx, creado.id);
      return creado;
    });
  } catch (error) {
    comoConflicto(error, datos.ruc);
  }
}

export async function actualizarEmisor(
  viewer: Viewer,
  id: string,
  payload: EmisorInput
) {
  ensureAdmin(viewer);
  const datos = limpiar(payload);
  try {
    return await prisma.$transaction(async (tx) => {
      const actualizado = await tx.emisor.update({
        where: { id },
        data: { ...datos, predeterminado: payload.predeterminado ?? false },
        select: CAMPOS_VISIBLES,
      });
      if (actualizado.predeterminado) await ordenarPredeterminado(tx, id);
      return actualizado;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError("Emisor no encontrado");
    }
    comoConflicto(error, datos.ruc);
  }
}

/**
 * Se borra solo si nunca emitió.
 *
 * Con facturas emitidas a su nombre lo impide la base (`onDelete: Restrict`) y
 * está bien que así sea: esas facturas salieron a nombre de ese RUC y el dato
 * tiene que seguir ahí. Para dejar de usarlo está `activo`.
 */
export async function borrarEmisor(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  try {
    return await prisma.emisor.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new NotFoundError("Emisor no encontrado");
      if (error.code === "P2003") {
        throw new ConflictError(
          "Este emisor ya emitió facturas, así que no se puede borrar. Desactivalo para dejar de usarlo."
        );
      }
    }
    throw error;
  }
}

/**
 * Guarda el `.p12` cifrado, después de comprobar que la contraseña sirve.
 *
 * Se verifica al subirlo y no al emitir: descubrir que la contraseña estaba mal
 * con la factura ya armada es el peor momento posible.
 */
export async function guardarCertificado(
  viewer: Viewer,
  id: string,
  p12: Buffer,
  password: string
) {
  ensureAdmin(viewer);
  if (!password) {
    throw new ValidationError("Hace falta la contraseña del certificado.");
  }
  // Tira un error con el motivo si la contraseña no sirve o el archivo no es.
  const datos = leerCertificado(p12, password);

  if (datos.vence.getTime() < Date.now()) {
    throw new ValidationError(
      `Ese certificado venció el ${datos.vence.toLocaleDateString("es-EC")}. Con uno vencido el SRI rechaza todo lo que se firme.`
    );
  }

  await prisma.emisor.update({
    where: { id },
    data: {
      certificado: cifrar(p12),
      certificadoPassword: cifrar(password),
      certificadoSujeto: datos.sujeto,
      certificadoVence: datos.vence,
    },
  });
  return datos;
}

export async function quitarCertificado(viewer: Viewer, id: string) {
  ensureAdmin(viewer);
  await prisma.emisor.update({
    where: { id },
    data: {
      certificado: null,
      certificadoPassword: null,
      certificadoSujeto: null,
      certificadoVence: null,
    },
  });
}

/**
 * El certificado en claro, para firmar. **Uso interno del servicio de emisión.**
 *
 * No hay ninguna ruta que exponga esto, y no debería haberla: es la clave
 * privada con la que se firma a nombre del contribuyente.
 */
export async function certificadoParaFirmar(emisorId: string) {
  const emisor = await prisma.emisor.findUnique({
    where: { id: emisorId },
    select: {
      ...CAMPOS_VISIBLES,
      certificado: true,
      certificadoPassword: true,
    },
  });
  if (!emisor) throw new NotFoundError("Emisor no encontrado");
  if (!emisor.certificado || !emisor.certificadoPassword) {
    throw new ValidationError(
      `${emisor.razonSocial} todavía no tiene cargado su certificado de firma.`
    );
  }
  if (emisor.certificadoVence && emisor.certificadoVence.getTime() < Date.now()) {
    throw new ValidationError(
      `El certificado de ${emisor.razonSocial} venció el ${emisor.certificadoVence.toLocaleDateString("es-EC")}.`
    );
  }
  return {
    emisor,
    p12: descifrar(emisor.certificado),
    password: descifrarTexto(emisor.certificadoPassword),
  };
}

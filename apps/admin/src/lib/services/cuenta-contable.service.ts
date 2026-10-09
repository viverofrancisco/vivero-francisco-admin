import {
  compararCodigos,
  codigoDelPadre,
  type CrearCuentaBody,
  type CuentaDelPlan,
  type EditarCuentaBody,
} from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isAdminRole, type Viewer } from "./viewer";

/**
 * El plan de cuentas.
 *
 * Es de ADMIN y STAFF, como todo lo que tiene que ver con plata. Las reglas
 * del árbol viven acá y no en la pantalla:
 *
 * - el código de una hija es el de su padre más un segmento (`1.1` → `1.1.4`);
 * - solo una cuenta de **grupo** tiene hijas; una de **detalle** recibe
 *   movimientos y no se subdivide —si hace falta, se convierte en grupo
 *   mientras no tenga movimientos—;
 * - el código no se cambia después de crear la cuenta;
 * - desactivar una cuenta desactiva todo lo que cuelga de ella, y activarla
 *   activa a sus padres, porque una cuenta activa bajo un grupo inactivo no
 *   aparecería en ningún lado.
 */

function ensureContabilidad(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError("La contabilidad es de administradores y staff");
  }
}

const SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  tipo: true,
  padreId: true,
  activa: true,
} as const;

export async function listarCuentas(viewer: Viewer): Promise<CuentaDelPlan[]> {
  ensureContabilidad(viewer);
  const cuentas = await prisma.cuentaContable.findMany({ select: SELECT });
  return cuentas.sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

export async function crearCuenta(
  viewer: Viewer,
  datos: CrearCuentaBody
): Promise<CuentaDelPlan> {
  ensureContabilidad(viewer);
  const codigo = datos.codigo.trim();

  if (datos.padreId) {
    const padre = await prisma.cuentaContable.findUnique({ where: { id: datos.padreId } });
    if (!padre) throw new NotFoundError("La cuenta padre no existe");
    if (padre.tipo !== "GRUPO") {
      throw new ValidationError(
        `${padre.codigo} ${padre.nombre} es de detalle: conviértela en grupo antes de agregarle cuentas`
      );
    }
    if (!padre.activa) {
      throw new ValidationError(`${padre.codigo} está inactiva: actívala primero`);
    }
    if (codigoDelPadre(codigo) !== padre.codigo) {
      throw new ValidationError(
        `El código tiene que ser ${padre.codigo} seguido de un número, por ejemplo ${padre.codigo}.1`
      );
    }
  } else if (codigo.includes(".")) {
    throw new ValidationError("Una cuenta sin padre lleva un solo número, por ejemplo 6");
  }

  const existe = await prisma.cuentaContable.findUnique({ where: { codigo } });
  if (existe) {
    throw new ConflictError(`Ya existe la cuenta ${codigo} ${existe.nombre}`);
  }

  return prisma.cuentaContable.create({
    data: {
      codigo,
      nombre: datos.nombre.trim(),
      tipo: datos.tipo,
      padreId: datos.padreId,
      createdById: viewer.id,
    },
    select: SELECT,
  });
}

/** Todas las que cuelgan de una cuenta, a cualquier profundidad. */
function descendientes(codigo: string) {
  return { codigo: { startsWith: `${codigo}.` } };
}

export async function editarCuenta(
  viewer: Viewer,
  id: string,
  datos: EditarCuentaBody
): Promise<CuentaDelPlan> {
  ensureContabilidad(viewer);
  const cuenta = await prisma.cuentaContable.findUnique({
    where: { id },
    include: { _count: { select: { hijas: true } } },
  });
  if (!cuenta) throw new NotFoundError("Cuenta no encontrada");

  if (datos.tipo === "DETALLE" && cuenta.tipo === "GRUPO" && cuenta._count.hijas > 0) {
    throw new ValidationError(
      "Tiene cuentas debajo: una cuenta de detalle no puede agrupar a otras"
    );
  }

  return prisma.$transaction(async (tx) => {
    if (datos.activa === false && cuenta.activa) {
      await tx.cuentaContable.updateMany({
        where: descendientes(cuenta.codigo),
        data: { activa: false },
      });
    }
    if (datos.activa === true && !cuenta.activa) {
      // Los padres, uno por uno hacia arriba.
      const ancestros: string[] = [];
      let c = codigoDelPadre(cuenta.codigo);
      while (c) {
        ancestros.push(c);
        c = codigoDelPadre(c);
      }
      if (ancestros.length > 0) {
        await tx.cuentaContable.updateMany({
          where: { codigo: { in: ancestros } },
          data: { activa: true },
        });
      }
    }
    return tx.cuentaContable.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
        ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
        ...(datos.tipo !== undefined ? { tipo: datos.tipo } : {}),
      },
      select: SELECT,
    });
  });
}

/**
 * Borrar es solo para la cuenta que se creó por error: sin hijas y —cuando
 * existan los asientos— sin movimientos. Una que se dejó de usar se desactiva.
 */
export async function eliminarCuenta(viewer: Viewer, id: string): Promise<void> {
  ensureContabilidad(viewer);
  const cuenta = await prisma.cuentaContable.findUnique({
    where: { id },
    include: { _count: { select: { hijas: true } } },
  });
  if (!cuenta) throw new NotFoundError("Cuenta no encontrada");
  if (cuenta._count.hijas > 0) {
    throw new ConflictError(
      "Tiene cuentas debajo. Elimínalas primero, o desactiva la cuenta"
    );
  }
  await prisma.cuentaContable.delete({ where: { id } });
}

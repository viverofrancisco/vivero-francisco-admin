import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";

/**
 * Fusionar dos fichas del mismo cliente.
 *
 * Pasa cuando alguien se registra desde la app con su correo y el vivero ya lo
 * tenía cargado con su teléfono: quedan dos fichas de la misma persona, y cada
 * una con la mitad de su historia. Se elige cuál **se conserva** y todo lo de
 * la otra pasa a ella: propiedades, visitas, planes, órdenes, informes, datos
 * de facturación, solicitudes, obras y la cuenta de acceso. La otra queda
 * archivada, con `fusionadoEnId` apuntando a la que quedó.
 *
 * Es del ADMIN y **no se deshace**: después de fusionar ya no se sabe qué era de
 * quién. Por eso hay una vista previa que dice exactamente qué se mueve.
 */

function ensureAdmin(viewer: Viewer) {
  if (viewer.role !== "ADMIN") {
    throw new ForbiddenError("Solo un administrador puede fusionar clientes");
  }
}

async function cargar(id: string) {
  const c = await prisma.cliente.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, password: true } },
      datosFacturacion: { select: { id: true, identificacion: true, esPredeterminado: true } },
      _count: {
        select: {
          propiedades: { where: { deletedAt: null } },
          visitas: { where: { deletedAt: null } },
          suscripciones: true,
          ordenes: true,
          informes: true,
          informeBorradores: true,
          solicitudes: true,
          obras: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!c) throw new NotFoundError("Cliente no encontrado");
  return c;
}

export interface VistaPreviaFusion {
  conservar: { id: string; nombre: string };
  absorber: { id: string; nombre: string };
  /** Cuánto de cada cosa pasa de la ficha absorbida a la que queda. */
  mueve: {
    propiedades: number;
    visitas: number;
    suscripciones: number;
    ordenes: number;
    informes: number;
    solicitudes: number;
    obras: number;
    datosFacturacion: number;
  };
  /** Qué pasa con las cuentas para entrar a la app. */
  cuenta: "ninguna" | "se-conserva" | "se-mueve" | "se-elimina-la-del-duplicado";
  /** Los datos de contacto que la que queda no tenía y toma de la otra. */
  completa: string[];
}

const CAMPOS_QUE_SE_COMPLETAN = [
  ["email", "correo"],
  ["telefono", "teléfono"],
  ["apellido", "apellido"],
  ["empresa", "empresa"],
  ["cedula", "cédula"],
  ["ruc", "RUC"],
  ["tipoPersona", "tipo de persona"],
] as const;

export async function vistaPreviaFusion(
  viewer: Viewer,
  conservarId: string,
  absorberId: string
): Promise<VistaPreviaFusion> {
  ensureAdmin(viewer);
  if (conservarId === absorberId) throw new ValidationError("Elige otro cliente");
  const [a, b] = await Promise.all([cargar(conservarId), cargar(absorberId)]);
  return {
    conservar: { id: a.id, nombre: nombreCliente(a) },
    absorber: { id: b.id, nombre: nombreCliente(b) },
    mueve: {
      propiedades: b._count.propiedades,
      visitas: b._count.visitas,
      suscripciones: b._count.suscripciones,
      ordenes: b._count.ordenes,
      informes: b._count.informes + b._count.informeBorradores,
      solicitudes: b._count.solicitudes,
      obras: b._count.obras,
      datosFacturacion: b.datosFacturacion.length,
    },
    cuenta: !b.user
      ? a.user
        ? "se-conserva"
        : "ninguna"
      : a.user
        ? "se-elimina-la-del-duplicado"
        : "se-mueve",
    completa: CAMPOS_QUE_SE_COMPLETAN.filter(([k]) => !a[k] && b[k]).map(([, etiqueta]) => etiqueta),
  };
}

export async function fusionarClientes(
  viewer: Viewer,
  conservarId: string,
  absorberId: string
): Promise<VistaPreviaFusion> {
  const vista = await vistaPreviaFusion(viewer, conservarId, absorberId);
  const [a, b] = await Promise.all([cargar(conservarId), cargar(absorberId)]);

  await prisma.$transaction(
    async (tx) => {
      const mover = { where: { clienteId: b.id }, data: { clienteId: a.id } };
      await tx.propiedad.updateMany(mover);
      await tx.suscripcion.updateMany(mover);
      await tx.visita.updateMany(mover);
      await tx.orden.updateMany(mover);
      await tx.informe.updateMany(mover);
      await tx.informeBorrador.updateMany(mover);
      await tx.solicitudCliente.updateMany(mover);
      await tx.obra.updateMany(mover);
      // Los enlaces de contraseña de la ficha que se va no sirven para nada.
      await tx.setPasswordToken.deleteMany({ where: { clienteId: b.id } });

      // Datos de facturación: el mismo RUC no puede estar dos veces en un
      // cliente, así que el repetido se va y lo que lo citaba pasa al de la
      // ficha que queda. El resto se mueve, sin quitarle el predeterminado.
      const porIdentificacion = new Map(a.datosFacturacion.map((d) => [d.identificacion, d.id]));
      const aTienePredeterminado = a.datosFacturacion.some((d) => d.esPredeterminado);
      for (const d of b.datosFacturacion) {
        const igual = porIdentificacion.get(d.identificacion);
        if (igual) {
          await tx.orden.updateMany({ where: { datoFacturacionId: d.id }, data: { datoFacturacionId: igual } });
          await tx.factura.updateMany({ where: { datoFacturacionId: d.id }, data: { datoFacturacionId: igual } });
          await tx.datoFacturacion.delete({ where: { id: d.id } });
        } else {
          await tx.datoFacturacion.update({
            where: { id: d.id },
            data: {
              clienteId: a.id,
              ...(aTienePredeterminado ? { esPredeterminado: false } : {}),
            },
          });
        }
      }

      // La cuenta para entrar a la app: la de la ficha que queda, si tiene;
      // si no, la del duplicado pasa a ella (es el caso de quien se registró
      // con su correo). Con las dos, la del duplicado se elimina: sus sesiones
      // dejan de servir.
      const completar: Record<string, unknown> = {};
      for (const [k] of CAMPOS_QUE_SE_COMPLETAN) {
        if (!a[k] && b[k]) completar[k] = b[k];
      }
      const nota = `Fusionado con la ficha de ${nombreCliente(b)} el ${new Date().toISOString().slice(0, 10)}.`;
      const notas = [a.notas, b.notas, nota].filter(Boolean).join("\n\n");

      await tx.cliente.update({
        where: { id: b.id },
        data: { deletedAt: new Date(), fusionadoEnId: a.id, userId: null, updatedById: viewer.id },
      });
      if (b.user && !a.user) {
        await tx.cliente.update({ where: { id: a.id }, data: { userId: b.user.id } });
      } else if (b.user && a.user) {
        await tx.user.delete({ where: { id: b.user.id } });
      }
      const queda = await tx.cliente.update({
        where: { id: a.id },
        data: { ...completar, notas, updatedById: viewer.id },
        select: { email: true, userId: true },
      });
      // La cuenta lleva el correo de su ficha (`correo-unico.ts`): si la cuenta
      // vino del duplicado, o la ficha tomó el correo de él, se alinean. Va
      // después de archivar el duplicado y borrar su cuenta, que lo tenían.
      if (queda.userId && queda.email) {
        await tx.user.update({
          where: { id: queda.userId },
          data: { email: queda.email.trim().toLowerCase() },
        });
      }
    },
    { timeout: 30_000 }
  );

  return vista;
}

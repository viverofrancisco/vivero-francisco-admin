import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendCodigoDeRegistroEmail } from "@/lib/email";
import type { RegistroBody } from "@vivero/shared";
import type { User } from "@/generated/prisma/client";
import { resolveClienteByIdentifier } from "./cliente-invite.service";
import {
  ConflictError,
  ForbiddenError,
  ServiceError,
  ValidationError,
} from "./errors";

/**
 * Crear la cuenta de un cliente desde la app.
 *
 * Hasta ahora toda cuenta la abría el vivero —el cliente recibía un enlace
 * para elegir su contraseña—, así que quien descargaba la app sin ser cliente
 * no tenía nada que hacer en ella. Ahora cualquiera se registra, y **queda
 * como cliente**: la ficha nace con su nombre, su correo y su teléfono, sin
 * propiedad, que es lo que tiene un cliente nuevo hasta que alguien va a ver
 * el jardín.
 *
 * El correo se prueba con un código de seis dígitos antes de crear nada. No es
 * un trámite: si el correo ya está en la ficha de un cliente, la cuenta se
 * **vincula a esa ficha** y ve sus visitas, y eso solo se le puede dar a quien
 * demuestre que la casilla es suya. Por la misma razón el teléfono no vincula:
 * no hay cómo probar que es de quien lo escribe.
 */

const VIGENCIA_DEL_CODIGO_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 5;

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/**
 * Primer paso: guarda los datos, con la contraseña ya cifrada, y manda el
 * código. Pedirlo de nuevo reemplaza el anterior —y su contador de intentos—,
 * que es lo que espera quien no lo encontró y apretó *Reenviar*.
 */
export async function solicitarCodigoDeRegistro(datos: RegistroBody): Promise<void> {
  const email = datos.email.trim().toLowerCase();
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const passwordHash = await bcrypt.hash(datos.password, 12);

  const fila = {
    nombre: datos.nombre.trim(),
    apellido: datos.apellido?.trim() || null,
    telefono: datos.telefono?.trim() || null,
    passwordHash,
    codigoHash: sha256(codigo),
    expiresAt: new Date(Date.now() + VIGENCIA_DEL_CODIGO_MS),
    intentos: 0,
  };
  await prisma.registroPendiente.upsert({
    where: { email },
    create: { email, ...fila },
    update: fila,
  });

  const envio = await sendCodigoDeRegistroEmail(email, fila.nombre, codigo);
  if (!envio.success) {
    throw new ServiceError(
      "No pudimos enviarte el código. Revisa el correo e intenta de nuevo.",
      "correo_no_enviado"
    );
  }
}

/**
 * Segundo paso: con el código correcto, la cuenta. Devuelve el `User` y el
 * cliente para abrir la sesión ahí mismo —pedirle que inicie sesión con lo que
 * acaba de escribir es un paso que no prueba nada—.
 */
export async function confirmarRegistro(
  emailCrudo: string,
  codigo: string
): Promise<{ user: User; clienteId: string }> {
  const email = emailCrudo.trim().toLowerCase();
  const pendiente = await prisma.registroPendiente.findUnique({ where: { email } });
  if (!pendiente || pendiente.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("El código venció. Pide uno nuevo.");
  }
  if (pendiente.intentos >= MAX_INTENTOS) {
    throw new ValidationError("Demasiados intentos. Pide un código nuevo.");
  }
  if (sha256(codigo.trim()) !== pendiente.codigoHash) {
    await prisma.registroPendiente.update({
      where: { email },
      data: { intentos: { increment: 1 } },
    });
    throw new ValidationError("El código no coincide.");
  }

  const existente = await resolveClienteByIdentifier(email);
  if (existente.status === "ambiguous") {
    // Dos fichas con el mismo correo: elegir una a ciegas podría mostrarle las
    // visitas de otra persona. Que lo resuelva el vivero.
    throw new ConflictError(
      "Ya hay más de un cliente con este correo. Comunícate con el vivero para entrar."
    );
  }

  const resultado = await prisma.$transaction(async (tx) => {
    if (existente.status === "ok") {
      // Ya era cliente: la cuenta se cuelga de su ficha y entra con lo suyo.
      // Lo que escribió de nombre y teléfono no pisa lo que el vivero cargó.
      const cliente = await tx.cliente.findUniqueOrThrow({
        where: { id: existente.cliente.id },
        include: { user: true },
      });
      if (cliente.user?.accesoRevocadoEl) {
        throw new ForbiddenError(
          "Tu acceso está bloqueado. Comunícate con el vivero."
        );
      }
      if (cliente.user) {
        // Probó con el código que el correo es suyo: es lo mismo que el
        // enlace de restablecer, así que la contraseña nueva vale.
        const user = await tx.user.update({
          where: { id: cliente.user.id },
          data: { password: pendiente.passwordHash },
        });
        return { user, clienteId: cliente.id };
      }
      const user = await tx.user.create({
        data: {
          role: "CLIENTE",
          email: `cliente+${cliente.id}@viverofrancisco.local`,
          password: pendiente.passwordHash,
          name: cliente.nombre,
          apellido: cliente.apellido,
        },
      });
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { userId: user.id },
      });
      return { user, clienteId: cliente.id };
    }

    // Nuevo: nace como cliente, sin propiedad. El `User` es la sombra de
    // autenticación de siempre, con el correo de relleno (ver
    // `establecerContrasena`): el login resuelve por la ficha.
    const cliente = await tx.cliente.create({
      data: {
        nombre: pendiente.nombre,
        apellido: pendiente.apellido,
        email,
        telefono: pendiente.telefono,
      },
    });
    const user = await tx.user.create({
      data: {
        role: "CLIENTE",
        email: `cliente+${cliente.id}@viverofrancisco.local`,
        password: pendiente.passwordHash,
        name: pendiente.nombre,
        apellido: pendiente.apellido,
      },
    });
    await tx.cliente.update({
      where: { id: cliente.id },
      data: { userId: user.id },
    });
    return { user, clienteId: cliente.id };
  });

  await prisma.registroPendiente.delete({ where: { email } }).catch(() => {});
  return resultado;
}

/**
 * Eliminar la cuenta desde la app, que Apple exige a toda app donde uno se
 * puede registrar.
 *
 * **Lo que se elimina es la cuenta**, la forma de entrar: el `User` se borra
 * —con él sus sesiones y sus avisos— y la ficha queda sin cuenta. Si la ficha
 * no tiene historia (nadie la visitó, no se le vendió nada), se va también:
 * es alguien que se registró y nunca llegó a ser cliente. Si tiene visitas,
 * órdenes o facturas, la ficha se queda, porque las facturas emitidas se
 * guardan por ley y las visitas las firmó quien las hizo.
 */
export async function eliminarCuentaDeCliente(
  userId: string,
  clienteId: string
): Promise<{ fichaEliminada: boolean }> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      userId: true,
      _count: {
        select: {
          visitas: true,
          ordenes: true,
          suscripciones: true,
          informes: true,
          datosFacturacion: true,
        },
      },
    },
  });
  if (!cliente || cliente.userId !== userId) {
    throw new ForbiddenError("Esta cuenta no es tuya");
  }

  const c = cliente._count;
  const sinHistoria =
    c.visitas + c.ordenes + c.suscripciones + c.informes + c.datosFacturacion === 0;

  await prisma.$transaction(async (tx) => {
    if (sinHistoria) {
      // Sus propiedades no tienen visitas (no hay ninguna), así que se van
      // con ella. Las solicitudes y los enlaces caen en cascada.
      await tx.propiedad.deleteMany({ where: { clienteId } });
      await tx.cliente.delete({ where: { id: clienteId } });
    } else {
      await tx.cliente.update({ where: { id: clienteId }, data: { userId: null } });
    }
    await tx.user.delete({ where: { id: userId } });
  });

  return { fichaEliminada: sinHistoria };
}

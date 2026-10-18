import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  sendAvisoDeCorreoCambiadoEmail,
  sendCodigoDeCambioDeCorreoEmail,
} from "@/lib/email";
import { ensureCorreoLibre, normalizarCorreo } from "./correo-unico";
import { NotFoundError, ServiceError, ValidationError } from "./errors";

/**
 * Un cliente cambia su correo desde la app, **probando que el nuevo es suyo**:
 * le llega un código a ese correo y solo con el código cambia. Sin eso,
 * cualquiera con el teléfono desbloqueado podría poner un correo propio y
 * quedarse con la cuenta (el correo es con lo que se entra y adonde llegan
 * los enlaces de contraseña). Al cambiar, el anterior recibe un aviso.
 *
 * El correo cambia en la ficha y en la cuenta a la vez —un correo es de una
 * sola persona (`correo-unico.ts`)— y se vuelve a revisar que esté libre al
 * confirmar, porque entre pedir el código y escribirlo alguien pudo tomarlo.
 */

const VIGENCIA_DEL_CODIGO_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 5;

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

async function fichaDe(userId: string, clienteId: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, userId, deletedAt: null },
    select: { id: true, nombre: true, email: true },
  });
  if (!cliente) throw new NotFoundError("Tu cuenta no está vinculada a un cliente.");
  return cliente;
}

export async function pedirCodigoDeCambioDeCorreo(
  userId: string,
  clienteId: string,
  emailCrudo: string
): Promise<void> {
  const cliente = await fichaDe(userId, clienteId);
  const email = normalizarCorreo(emailCrudo);
  if (!email) throw new ValidationError("Escribe un correo válido");
  if (email === normalizarCorreo(cliente.email)) {
    throw new ValidationError("Ese ya es tu correo.");
  }
  await ensureCorreoLibre(email, "cliente", { clienteId, userId });

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const fila = {
    emailNuevo: email,
    codigoHash: sha256(codigo),
    expiresAt: new Date(Date.now() + VIGENCIA_DEL_CODIGO_MS),
    intentos: 0,
  };
  await prisma.cambioDeCorreoPendiente.upsert({
    where: { userId },
    create: { userId, ...fila },
    update: fila,
  });

  const envio = await sendCodigoDeCambioDeCorreoEmail(email, cliente.nombre, codigo);
  if (!envio.success) {
    console.error("[cambio de correo] no se pudo enviar el código:", envio.error);
    throw new ServiceError(
      "No pudimos enviarte el código. Revisa el correo e intenta de nuevo.",
      "correo_no_enviado"
    );
  }
}

/** Con el código correcto cambia el correo; devuelve el nuevo. */
export async function confirmarCambioDeCorreo(
  userId: string,
  clienteId: string,
  codigo: string
): Promise<string> {
  const cliente = await fichaDe(userId, clienteId);
  const pendiente = await prisma.cambioDeCorreoPendiente.findUnique({ where: { userId } });
  if (!pendiente || pendiente.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("El código venció. Pide uno nuevo.");
  }
  if (pendiente.intentos >= MAX_INTENTOS) {
    throw new ValidationError("Demasiados intentos. Pide un código nuevo.");
  }
  if (sha256(codigo.trim()) !== pendiente.codigoHash) {
    await prisma.cambioDeCorreoPendiente.update({
      where: { userId },
      data: { intentos: { increment: 1 } },
    });
    throw new ValidationError("El código no coincide.");
  }

  const nuevo = pendiente.emailNuevo;
  await ensureCorreoLibre(nuevo, "cliente", { clienteId, userId });
  await prisma.$transaction([
    prisma.cliente.update({ where: { id: cliente.id }, data: { email: nuevo } }),
    prisma.user.update({ where: { id: userId }, data: { email: nuevo } }),
    prisma.cambioDeCorreoPendiente.delete({ where: { userId } }),
  ]);

  if (cliente.email) {
    // Que no llegue el aviso no deshace el cambio, que ya está probado.
    await sendAvisoDeCorreoCambiadoEmail(cliente.email, cliente.nombre, nuevo).catch(
      () => {}
    );
  }
  return nuevo;
}

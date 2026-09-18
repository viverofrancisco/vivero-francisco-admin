import { prisma } from "@/lib/prisma";
import { validateCredentials } from "@/lib/auth-helpers";
import { validateClienteCredentials } from "./cliente-invite.service";
import type { User, UserRole } from "@/generated/prisma/client";

/**
 * Una sola puerta para entrar a la app, sea quien sea.
 *
 * Había dos pantallas y dos rutas: la del equipo —usuario o correo, contra
 * `User`— y la del cliente —teléfono o correo, contra su ficha—. Entonces lo
 * primero que la app le preguntaba a alguien que acababa de instalarla era de
 * qué lado del negocio está, que es una pregunta nuestra y no suya: el
 * jardinero no sabe que existe una pantalla de clientes, y el cliente que
 * aterriza en la del equipo escribe su teléfono, recibe "Credenciales
 * inválidas" y se queda sin entender que estaba en el lugar equivocado.
 *
 * **Quién es lo sabe el servidor**, que es el único que puede saberlo: prueba
 * las dos formas de encontrar la cuenta y devuelve el rol junto con la sesión.
 *
 * El orden importa poco y algo: primero `User` —usuario, o correo— y después la
 * ficha del cliente. Un usuario sin arroba solo existe del lado del equipo y un
 * teléfono solo del lado del cliente, así que el único identificador que puede
 * estar en los dos lados es un correo. Ahí gana el que valide la contraseña: si
 * la cuenta del equipo no la valida, se prueba la del cliente, y una persona
 * que es las dos cosas entra con la contraseña que haya escrito.
 */
export interface SesionDeApp {
  user: User;
  role: UserRole;
  personalId: string | null;
  clienteId: string | null;
}

export async function autenticarEnLaApp(
  identificador: string,
  password: string
): Promise<SesionDeApp | null> {
  // 1. La cuenta del equipo: usuario o correo. `validateCredentials` ya
  //    rechaza al que tiene el acceso revocado y al que nunca puso contraseña.
  const user = await validateCredentials(identificador, password);
  if (user) {
    if (user.role === "CLIENTE") {
      // Un cliente puede tener correo en su `User` además de en su ficha, así
      // que también entra por acá. Lo que necesita es su `clienteId`: sin eso
      // la sesión no está acotada a nadie y no puede ver ni sus propias
      // visitas.
      const cliente = await prisma.cliente.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!cliente) return null;
      return { user, role: "CLIENTE", personalId: null, clienteId: cliente.id };
    }

    const personal = await prisma.personal.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return {
      user,
      role: user.role,
      personalId: personal?.id ?? null,
      clienteId: null,
    };
  }

  // 2. La ficha del cliente: teléfono o correo.
  const cliente = await validateClienteCredentials(identificador, password);
  if (!cliente) return null;
  return {
    user: cliente.user,
    role: "CLIENTE",
    personalId: null,
    clienteId: cliente.clienteId,
  };
}

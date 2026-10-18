import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ConflictError } from "./errors";

/**
 * **Un correo es de una sola persona dentro de su lado**: el equipo (ADMIN,
 * STAFF, PERSONAL) por un lado y los clientes por otro, como en Shopify,
 * donde el staff y los *customers* son mundos aparte. Dentro de los clientes
 * no lo comparten dos fichas, ni una ficha y la cuenta de otro cliente; dentro
 * del equipo, no lo comparten dos cuentas. Entre lados sí: quien trabaja en el
 * vivero puede comprarle plantas con su mismo correo.
 *
 * La base lo garantiza con índices únicos parciales escritos a mano:
 * `User_email_equipo_key` y `User_email_cliente_key` sobre `lower(email)` de
 * cada lado, y `Cliente_email_vivo_key` sobre las fichas **vivas** (la
 * fusionada queda archivada con el suyo). Este chequeo va antes de escribir
 * para responder con un mensaje claro en vez de un error de la base.
 */

export type LadoDelCorreo = "cliente" | "equipo";

/** Los roles de cada lado. */
export const ROLES_DEL_LADO = {
  equipo: ["ADMIN", "STAFF", "PERSONAL"],
  cliente: ["CLIENTE"],
} as const;

type Db = Prisma.TransactionClient | typeof prisma;

/** Minúsculas y sin espacios; vacío es "sin correo". */
export function normalizarCorreo(email: string | null | undefined): string | null {
  const limpio = email?.trim().toLowerCase();
  return limpio ? limpio : null;
}

/**
 * Falla con un `ConflictError` si el correo ya es de alguien. El mensaje **no
 * dice de quién**: a un cliente no le corresponde saber que es de alguien del
 * equipo, ni a nadie que pruebe correos saber a qué tipo de cuenta pertenece.
 * `clienteId` / `userId` son la ficha y la cuenta que se están guardando, que
 * no chocan consigo mismas.
 */
export async function ensureCorreoLibre(
  email: string | null,
  lado: LadoDelCorreo,
  excepto: { clienteId?: string | null; userId?: string | null } = {},
  db: Db = prisma
): Promise<void> {
  if (!email) return;

  // Del lado de los clientes también cuentan las fichas, tengan cuenta o no.
  const ficha =
    lado === "cliente"
      ? await db.cliente.findFirst({
          where: {
            deletedAt: null,
            email: { equals: email, mode: "insensitive" },
            ...(excepto.clienteId ? { id: { not: excepto.clienteId } } : {}),
          },
          select: { id: true },
        })
      : null;
  const cuenta = ficha
    ? null
    : await db.user.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          role: { in: [...ROLES_DEL_LADO[lado]] },
          ...(excepto.userId ? { id: { not: excepto.userId } } : {}),
        },
        select: { id: true },
      });
  if (ficha || cuenta) {
    throw new ConflictError(CORREO_YA_EXISTE);
  }
}

export const CORREO_YA_EXISTE = "Ese correo ya está registrado.";

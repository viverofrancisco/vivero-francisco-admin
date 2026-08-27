import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/mobile/jwt";

/**
 * Enlaces para establecer una contraseña.
 *
 * Uno solo sirve para las tres cosas que en el fondo son la misma: invitar a un
 * usuario del portal, invitar a un cliente, y restablecerle la contraseña a
 * cualquiera de los dos. En todos los casos alguien recibe un enlace, elige una
 * contraseña y queda adentro.
 *
 * El token viaja en claro **una sola vez**, dentro del enlace; en la base queda
 * su sha256. Eso significa que nadie —ni con la base delante— puede reconstruir
 * un enlace ya emitido, y también que si se pierde no hay forma de recuperarlo:
 * se genera otro.
 */

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_HORA = 60 * MS_POR_MINUTO;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Para qué se emitió el enlace. Solo cambia cuánto vive y qué dice el correo. */
export type TipoEnlace = "invitacion" | "restablecer";

/**
 * Cuánto vive cada enlace, y por qué son distintos.
 *
 * La **invitación** dura una semana: la cuenta todavía no sirve para nada —no
 * tiene contraseña, no entra a ningún lado— así que el riesgo de que el enlace
 * ande dando vueltas es bajo, y del otro lado la respuesta razonable a "te
 * invitamos al portal" es "lo hago el lunes".
 *
 * El **restablecimiento** dura una hora: ahí la cuenta ya existe y funciona, y
 * el enlace es una llave que la abre. Una hora es lo habitual en la industria
 * —OWASP recomienda del orden de 20 minutos, y los productos que uno usa van
 * de 1 a 24 horas— y alcanza para mandarlo por WhatsApp y que lo abran. Si
 * caduca, generar otro es un clic.
 */
export const VIGENCIA_MS: Record<TipoEnlace, number> = {
  invitacion: 7 * MS_POR_DIA,
  restablecer: 1 * MS_POR_HORA,
};

/** Cómo se dice esa vigencia en un correo o en pantalla. */
export const VIGENCIA_TEXTO: Record<TipoEnlace, string> = {
  invitacion: "7 días",
  restablecer: "1 hora",
};

/**
 * El del cliente dura un día: lo pide la propia persona desde la app y lo usa
 * en el momento, pero puede tener que abrir el correo en otro dispositivo.
 */
const VIGENCIA_CLIENTE_MS = 24 * MS_POR_HORA;

/**
 * De dónde cuelga el enlace: la URL pública del portal.
 *
 * Cae en `NEXTAUTH_URL` si no hay `APP_BASE_URL`, porque son el mismo valor
 * —dónde se sirve la app— y tener dos variables que deben coincidir es una
 * trampa: se configura una, se olvida la otra, y el síntoma aparece recién en
 * el correo de otra persona.
 *
 * Si no hay ninguna, en producción se rompe a propósito. Un enlace apuntando a
 * `localhost` **no falla acá sino en la bandeja de quien lo recibe**, y para
 * cuando alguien se entera ya se mandaron invitaciones que no abren; que
 * reviente el botón de invitar es preferible, porque ahí hay alguien mirando.
 */
function baseUrl(): string {
  const configurada = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  if (!configurada) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Falta APP_BASE_URL (o NEXTAUTH_URL): sin una de las dos los enlaces de contraseña saldrían apuntando a localhost."
      );
    }
    return "http://localhost:3001";
  }
  return configurada.replace(/\/$/, "");
}

/** A dónde entra quien usa el enlace. Cambia el texto, no el mecanismo. */
export type DestinoAcceso = "portal" | "app";

export interface EnlaceDeAcceso {
  /** La URL completa, lista para copiar. */
  url: string;
  expiraEl: Date;
}

/**
 * Emite un enlace y **anula los anteriores** que sigan sin usar.
 *
 * Anularlos importa: si se generan dos enlaces para la misma persona porque el
 * primero se perdió, el primero tiene que dejar de servir. Si no, un enlace
 * traspapelado en un chat sigue abriendo la puerta durante una semana.
 */
async function emitir(
  dueno: { clienteId: string } | { userId: string },
  vigenciaMs: number
): Promise<EnlaceDeAcceso> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + vigenciaMs);

  await prisma.$transaction([
    prisma.setPasswordToken.updateMany({
      where: { ...dueno, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.setPasswordToken.create({
      data: { ...dueno, tokenHash: sha256(token), expiresAt },
    }),
  ]);

  return { url: `${baseUrl()}/establecer-contrasena?token=${token}`, expiraEl: expiresAt };
}

/** Enlace para un usuario del portal (staff, admin de sector). */
export function crearEnlaceParaUsuario(
  userId: string,
  tipo: TipoEnlace
): Promise<EnlaceDeAcceso> {
  return emitir({ userId }, VIGENCIA_MS[tipo]);
}

/** Enlace para un cliente, que entra por la app. */
export function crearEnlaceParaCliente(
  clienteId: string
): Promise<EnlaceDeAcceso> {
  return emitir({ clienteId }, VIGENCIA_CLIENTE_MS);
}

// ──────────────────────────────────────────────
// Leer y consumir
// ──────────────────────────────────────────────

/**
 * Por qué un enlace no sirve. Cada caso tiene una salida distinta, y decir las
 * tres juntas —"no es válido, ya fue usado o caducó"— deja a la persona sin
 * saber cuál le tocó ni qué hacer.
 */
export type MotivoInvalido = "vencido" | "usado" | "desconocido";

export interface InfoDeEnlace {
  valido: boolean;
  /** Para saludar a quien abre el enlace. */
  nombre?: string;
  /**
   * A dónde entra. Se devuelve **también cuando el enlace ya no sirve**: la
   * página tiene que saber si mandar a alguien al portal o a la app, y un
   * token muerto no revela nada que valga la pena esconder.
   */
  destino?: DestinoAcceso;
  motivo?: MotivoInvalido;
}

/** Qué hay detrás de un token, para que la página sepa qué decir. */
export async function infoDeEnlace(token: string): Promise<InfoDeEnlace> {
  const record = await prisma.setPasswordToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      cliente: {
        select: { nombre: true, apellido: true, empresa: true, deletedAt: true },
      },
      user: { select: { name: true, apellido: true } },
    },
  });
  if (!record) return { valido: false, motivo: "desconocido" };

  const destino: DestinoAcceso | undefined = record.cliente
    ? "app"
    : record.user
      ? "portal"
      : undefined;
  // Sin dueño (o con un cliente borrado) no hay nada que ofrecer, y tampoco
  // vale la pena explicar por qué.
  if (!destino || record.cliente?.deletedAt) {
    return { valido: false, motivo: "desconocido" };
  }

  const nombre = record.cliente
    ? nombreCliente(record.cliente)
    : [record.user?.name, record.user?.apellido].filter(Boolean).join(" ") ||
      undefined;

  if (record.usedAt) return { valido: false, motivo: "usado", destino, nombre };
  if (record.expiresAt.getTime() < Date.now()) {
    return { valido: false, motivo: "vencido", destino, nombre };
  }
  return { valido: true, destino, nombre };
}

export type ResultadoEstablecer =
  | { ok: true; destino: DestinoAcceso }
  | { ok: false; motivo: "invalido" | "vencido" };

/**
 * Valida el token y guarda la contraseña.
 *
 * El token se marca usado dentro de la misma transacción que escribe la
 * contraseña: si algo falla, el enlace sigue sirviendo, que es preferible a
 * quemarlo sin haber dejado a nadie adentro.
 */
export async function establecerContrasena(
  token: string,
  password: string
): Promise<ResultadoEstablecer> {
  const record = await prisma.setPasswordToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt) return { ok: false, motivo: "invalido" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, motivo: "vencido" };
  }

  const hashed = await bcrypt.hash(password, 12);

  if (record.userId) {
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) return { ok: false, motivo: "invalido" };
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      }),
      prisma.setPasswordToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true, destino: "portal" };
  }

  const cliente = record.clienteId
    ? await prisma.cliente.findUnique({ where: { id: record.clienteId } })
    : null;
  if (!cliente || cliente.deletedAt) return { ok: false, motivo: "invalido" };

  await prisma.$transaction(async (tx) => {
    let userId: string | null = cliente.userId;

    if (userId) {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (existing) {
        await tx.user.update({
          where: { id: userId },
          data: { password: hashed },
        });
      } else {
        userId = null;
      }
    }

    if (!userId) {
      // El `User` de un cliente es solo la sombra de autenticación: su correo
      // es un placeholder porque el login resuelve por la ficha del cliente,
      // no por `User.email`, y así no choca con el correo de alguien del
      // personal que sea también cliente.
      const created = await tx.user.create({
        data: {
          role: "CLIENTE",
          email: `cliente+${cliente.id}@viverofrancisco.local`,
          password: hashed,
        },
      });
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { userId: created.id },
      });
    }

    await tx.setPasswordToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  });

  return { ok: true, destino: "app" };
}

// ──────────────────────────────────────────────
// Revocar y devolver el acceso
// ──────────────────────────────────────────────

/**
 * Le cierra la puerta a alguien sin borrar su cuenta.
 *
 * No se borra porque su nombre sigue firmando las visitas y los informes que
 * hizo; borrarlo dejaría huecos en el historial. Lo que se corta es todo lo
 * que sirve para entrar:
 *
 * - la marca en `accesoRevocadoEl`, que los dos caminos de login consultan;
 * - los enlaces de contraseña pendientes, para que uno viejo no la reabra;
 * - los refresh tokens del móvil, para que la app no siga renovando sola.
 *
 * Lo que **no** se toca es la contraseña: si mañana vuelve, quitar el bloqueo
 * alcanza y no hay que inventar nada nuevo.
 */
export async function revocarAcceso(userId: string): Promise<void> {
  const ahora = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { accesoRevocadoEl: ahora },
    }),
    prisma.setPasswordToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: ahora },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: ahora },
    }),
  ]);
}

/**
 * Le devuelve el acceso. Vuelve con la contraseña que ya tenía; si no la
 * recuerda —o nunca llegó a ponerse una— lo que sigue es un enlace nuevo.
 */
export async function restaurarAcceso(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { accesoRevocadoEl: null },
  });
}

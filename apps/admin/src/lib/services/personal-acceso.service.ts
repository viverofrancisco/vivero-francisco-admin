import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizarUsuario,
  pareceCorreo,
  restaurarAcceso,
  revocarAcceso,
  USUARIO_REGEX,
} from "./acceso.service";

/**
 * El acceso de quien trabaja en el campo.
 *
 * Un jardinero no tiene correo, así que su cuenta no se puede invitar como la
 * del resto: lo que se le crea es un **usuario** —inicial del nombre más el
 * apellido, `fherrera`— y un enlace de un solo uso con el que elige su propia
 * contraseña.
 *
 * La cuenta **nace con la ficha**, en la misma transacción. Era un botón
 * aparte, y un botón aparte es un paso que alguien se saltea: quedaba gente
 * cargada que no podía entrar a la app, y nadie se enteraba hasta que había que
 * cargar un parte. Nada se pierde por crearla siempre —una cuenta sin
 * contraseña no entra a ningún lado— y al que no deba entrar se le revoca.
 *
 * Que la contraseña no la ponga el administrador no es ceremonia: una clave
 * temporal hay que inventarla, dictarla y confiar en que la cambien después
 * —cosa que no pasa—, y mientras tanto queda una contraseña que saben dos
 * personas. Con el enlace, la única que la conoce es quien la eligió.
 */

/** Qué se le muestra a la oficina sobre la cuenta de una persona. */
export interface EstadoCuentaPersonal {
  userId: string;
  usuario: string | null;
  /** Ya eligió una contraseña; hasta entonces la cuenta existe pero no entra. */
  tieneContrasena: boolean;
  /** Se le cortó el acceso. La cuenta sigue, con su historial. */
  revocado: boolean;
  /** Hay un enlace vivo sin usar: se lo mandamos y falta que lo abra. */
  enlacePendiente: boolean;
}

const SELECT_CUENTA = {
  id: true,
  usuario: true,
  password: true,
  accesoRevocadoEl: true,
  _count: {
    select: {
      setPasswordTokens: {
        where: { usedAt: null, anuladoEl: null, expiresAt: { gt: new Date() } },
      },
    },
  },
} as const;

type FilaCuenta = {
  id: string;
  usuario: string | null;
  password: string | null;
  accesoRevocadoEl: Date | null;
  _count: { setPasswordTokens: number };
};

function aEstado(user: FilaCuenta): EstadoCuentaPersonal {
  return {
    userId: user.id,
    usuario: user.usuario,
    tieneContrasena: user.password !== null,
    revocado: user.accesoRevocadoEl !== null,
    enlacePendiente: user._count.setPasswordTokens > 0,
  };
}

/**
 * El acceso de alguien, en una palabra.
 *
 * Son cuatro estados y no dos porque los dos del medio se arreglan distinto:
 * a quien nunca abrió su enlace hay que mandárselo otra vez, y a quien fue
 * revocado hay que devolverle el acceso. Verlos iguales —"no entra"— dejaba a
 * la oficina probando.
 */
export type EstadoAcceso = "SIN_CUENTA" | "PENDIENTE" | "ACTIVO" | "REVOCADO";

export function estadoDeAcceso(
  /**
   * Lo mínimo para decidirlo, no un `EstadoCuentaPersonal` entero: la lista de
   * personal lo calcula sobre lo que trae su propia consulta y no tiene por qué
   * armar una cuenta completa —con un `userId` de mentira— para preguntar.
   */
  cuenta: { tieneContrasena: boolean; revocado: boolean } | null
): EstadoAcceso {
  if (!cuenta) return "SIN_CUENTA";
  if (cuenta.revocado) return "REVOCADO";
  return cuenta.tieneContrasena ? "ACTIVO" : "PENDIENTE";
}

/** Cómo está el acceso de esta persona, o `null` si nunca se le creó cuenta. */
export async function estadoCuentaPersonal(
  personalId: string
): Promise<EstadoCuentaPersonal | null> {
  const personal = await prisma.personal.findUnique({
    where: { id: personalId },
    select: { user: { select: SELECT_CUENTA } },
  });
  if (!personal) throw new NotFoundError("Personal no encontrado");
  return personal.user ? aEstado(personal.user) : null;
}

/**
 * Valida un usuario y lo deja como se va a guardar.
 *
 * El mensaje dice exactamente qué se puede escribir porque el error aparece
 * mientras alguien inventa el usuario de otro, y "usuario inválido" a secas
 * manda a probar a ciegas.
 */
function limpiarUsuario(valor: string): string {
  const usuario = normalizarUsuario(valor);
  if (pareceCorreo(usuario)) {
    throw new ValidationError("El usuario no lleva arroba: es un nombre corto");
  }
  if (!USUARIO_REGEX.test(usuario)) {
    throw new ValidationError(
      "El usuario va en minúsculas, de 3 a 30 caracteres, con letras, números, punto, guion o guion bajo"
    );
  }
  return usuario;
}

/**
 * El usuario que le toca: inicial del nombre y primer apellido.
 *
 * Sin tildes ni eñes —se dicta por teléfono y se escribe en el teclado de un
 * celular— y sin nada que no sea letra o número.
 */
export function usuarioSugerido(nombre: string, apellido: string | null): string {
  const limpiar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const nombres = nombre.trim().split(/\s+/).filter(Boolean);
  const apellidos = (apellido ?? "").trim().split(/\s+/).filter(Boolean);
  const candidato = `${limpiar(nombres[0]?.slice(0, 1) ?? "")}${limpiar(apellidos[0] ?? "")}`;
  if (candidato.length >= 3) return candidato.slice(0, 30);

  // Sin apellido no hay dos cosas que juntar: se usa el nombre entero, y si ni
  // eso alcanza —"Ana" sí, "Jo" no— se rellena, porque un usuario de dos
  // caracteres no pasa la validación y la ficha no se podría guardar.
  const solo = limpiar(nombres.join(""));
  return (solo.length >= 3 ? solo : `${solo}usuario`).slice(0, 30);
}

/**
 * El primero que esté libre: `fherrera`, `fherrera2`, `fherrera3`…
 *
 * Dos Fernando Herrera en la misma cuadrilla no es raro, y el único de la base
 * rechazaría al segundo justo al guardar su ficha, donde nadie está pensando en
 * usuarios. El número se agrega acá y después se puede cambiar a mano.
 */
async function usuarioLibre(
  tx: Prisma.TransactionClient,
  nombre: string,
  apellido: string | null
): Promise<string> {
  const base = usuarioSugerido(nombre, apellido);
  for (let intento = 1; intento <= 50; intento++) {
    const candidato = intento === 1 ? base : `${base.slice(0, 28)}${intento}`;
    const tomado = await tx.user.findUnique({
      where: { usuario: candidato },
      select: { id: true },
    });
    if (!tomado) return candidato;
  }
  throw new ConflictError("No pudimos generar un usuario libre");
}

/** Si ya lo tiene otro. El único de la base también lo impide; esto lo explica. */
async function ensureUsuarioLibre(usuario: string, exceptoUserId?: string) {
  const otro = await prisma.user.findUnique({
    where: { usuario },
    select: { id: true },
  });
  if (otro && otro.id !== exceptoUserId) {
    throw new ConflictError(`El usuario "${usuario}" ya está tomado`);
  }
}

/**
 * Le crea la cuenta a alguien que ya tiene ficha.
 *
 * Recibe el `tx` porque va **dentro de la transacción de la ficha**: un `User`
 * con rol PERSONAL suelto no se ve desde ningún lado del portal —la lista de
 * usuarios es solo la oficina— y quedaría ocupando el usuario.
 *
 * No emite el enlace. La contraseña se elige con uno que se genera cuando hace
 * falta, y emitirlo acá quemaría su semana de vigencia el día que se carga la
 * ficha, que suele ser antes de que la persona empiece.
 */
export async function crearCuentaPersonal(
  tx: Prisma.TransactionClient,
  personal: { id: string; nombre: string; apellido: string | null }
): Promise<EstadoCuentaPersonal> {
  const usuario = await usuarioLibre(tx, personal.nombre, personal.apellido);
  const creado = await tx.user.create({
    data: {
      name: personal.nombre,
      apellido: personal.apellido,
      usuario,
      role: "PERSONAL",
    },
    select: SELECT_CUENTA,
  });
  await tx.personal.update({
    where: { id: personal.id },
    data: { userId: creado.id },
  });
  return aEstado(creado);
}

/**
 * Le cambia el usuario.
 *
 * Existe porque el usuario se elige de apuro y se dicta por teléfono: un error
 * de tipeo, si no, obliga a borrar la cuenta y con ella el historial de quién
 * cargó cada parte. Cambiarlo **no** toca la contraseña ni los enlaces vivos:
 * lo que cambia es con qué se entra, no si se puede.
 */
export async function cambiarUsuarioPersonal(
  personalId: string,
  usuarioPedido: string
): Promise<EstadoCuentaPersonal> {
  const personal = await prisma.personal.findUnique({
    where: { id: personalId },
    select: { userId: true },
  });
  if (!personal?.userId) throw new NotFoundError("Esta persona no tiene cuenta");

  const usuario = limpiarUsuario(usuarioPedido);
  await ensureUsuarioLibre(usuario, personal.userId);

  const user = await prisma.user.update({
    where: { id: personal.userId },
    data: { usuario },
    select: SELECT_CUENTA,
  });
  return aEstado(user);
}

/**
 * Corta o devuelve el acceso de una persona, sin borrarle nada.
 *
 * Es el mismo par que usa la oficina —la cuenta queda, porque su nombre firma
 * los partes y las visitas que cargó— con la ficha de por medio, para que la
 * pantalla de Personal no tenga que saber el id del usuario.
 *
 * Volver **no** genera un enlace: vuelve con la contraseña que ya tenía. Si no
 * la recuerda, lo que sigue es un enlace nuevo, que es otro botón.
 */
export async function setAccesoPersonal(
  personalId: string,
  revocado: boolean
): Promise<EstadoCuentaPersonal> {
  const personal = await prisma.personal.findUnique({
    where: { id: personalId },
    select: { userId: true },
  });
  if (!personal?.userId) throw new NotFoundError("Esta persona no tiene cuenta");

  if (revocado) await revocarAcceso(personal.userId);
  else await restaurarAcceso(personal.userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: personal.userId },
    select: SELECT_CUENTA,
  });
  return aEstado(user);
}

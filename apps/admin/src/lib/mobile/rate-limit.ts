import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimiterResult = { success: boolean; reset: number; remaining: number };
type Limiter = { limit: (key: string) => Promise<LimiterResult> };

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedis();

function alwaysAllow(): Limiter {
  return {
    async limit() {
      return { success: true, reset: Date.now(), remaining: Number.MAX_SAFE_INTEGER };
    },
  };
}

function make(prefix: string, limit: number, window: `${number} ${"s" | "m" | "h" | "d"}`): Limiter {
  if (!redis) return alwaysAllow();
  return new Ratelimit({
    redis,
    prefix,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
  });
}

const loginPerEmailHour = make("login:email:1h", 10, "1 h");

export interface RateLimitError {
  blocked: true;
  reason: string;
  retryAfterSeconds: number;
}

function retryAfter(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export async function enforceLoginLimit(
  email: string
): Promise<RateLimitError | null> {
  const res = await loginPerEmailHour.limit(email.toLowerCase());
  if (!res.success) {
    return {
      blocked: true,
      reason: "Demasiados intentos de inicio de sesión. Intenta en una hora.",
      retryAfterSeconds: retryAfter(res.reset),
    };
  }
  return null;
}

const registroPorCorreoHora = make("registro:email:1h", 5, "1 h");
const registroPorIpHora = make("registro:ip:1h", 20, "1 h");

/**
 * Pedir el código de registro manda un correo, y un correo cuesta cuota de la
 * cuenta de Gmail y molesta a quien lo recibe si no lo pidió. Por correo y por
 * IP: cinco por casilla alcanzan para equivocarse y volver a pedir, y la IP
 * frena a quien pruebe muchas casillas.
 */
export async function enforceRegistroLimit(
  email: string,
  ip: string | null
): Promise<RateLimitError | null> {
  const porCorreo = await registroPorCorreoHora.limit(email.toLowerCase());
  const porIp = ip ? await registroPorIpHora.limit(ip) : null;
  const bloqueo = !porCorreo.success ? porCorreo : porIp && !porIp.success ? porIp : null;
  if (bloqueo) {
    return {
      blocked: true,
      reason: "Pediste demasiados códigos. Intenta de nuevo en una hora.",
      retryAfterSeconds: retryAfter(bloqueo.reset),
    };
  }
  return null;
}

const solicitudInvitadoPorIp = make("solicitud-invitado:ip:1h", 10, "1 h");

/**
 * Una solicitud sin cuenta no tiene a quién atarse, y cada una le suena a un
 * administrador en el teléfono. Diez por hora y por IP alcanzan para quien de
 * verdad pide algo, y frenan a quien quiera llenar la lista.
 */
export async function enforceSolicitudInvitadoLimit(
  ip: string | null
): Promise<RateLimitError | null> {
  if (!ip) return null;
  const res = await solicitudInvitadoPorIp.limit(ip);
  if (!res.success) {
    return {
      blocked: true,
      reason: "Enviaste muchas solicitudes. Intenta de nuevo en una hora.",
      retryAfterSeconds: retryAfter(res.reset),
    };
  }
  return null;
}

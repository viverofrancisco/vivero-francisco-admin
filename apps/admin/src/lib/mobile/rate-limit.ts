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

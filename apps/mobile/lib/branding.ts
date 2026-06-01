import { useEffect, useState } from "react";
import { API_BASE_URL } from "./config";

export interface Branding {
  nombre: string | null;
  logoUrl: string | null;
}

const FALLBACK: Branding = { nombre: "Vivero Francisco", logoUrl: null };

// Module-level cache so the first load on a screen primes subsequent screens.
let cached: Branding | null = null;
let inflight: Promise<Branding> | null = null;
const subscribers = new Set<(b: Branding) => void>();

function publish(b: Branding) {
  cached = b;
  for (const fn of subscribers) fn(b);
}

async function fetchBranding(): Promise<Branding> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/branding`);
      if (!res.ok) throw new Error("branding fetch failed");
      const data = (await res.json()) as Partial<Branding>;
      const next: Branding = {
        nombre: data.nombre ?? FALLBACK.nombre,
        logoUrl: data.logoUrl ?? null,
      };
      publish(next);
      return next;
    } catch {
      const fallback = cached ?? FALLBACK;
      publish(fallback);
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useBranding(): Branding {
  const [state, setState] = useState<Branding>(cached ?? FALLBACK);
  useEffect(() => {
    if (!cached) fetchBranding();
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);
  return state;
}

export function refreshBranding() {
  cached = null;
  return fetchBranding();
}

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

export interface Branding {
  nombre: string | null;
  logoUrl: string | null;
}

const FALLBACK: Branding = { nombre: "Vivero Francisco", logoUrl: null };
const CLAVE = "branding:v1";

/**
 * El nombre y el logo del vivero, **guardados en el teléfono**.
 *
 * Se pedían al servidor en cada arranque, y mientras llegaban las pantallas
 * sin sesión —el login, crear contraseña— mostraban el nombre en texto y
 * medio segundo después el logo: un salto en lo primero que se ve. Ahora lo
 * último que se supo queda en AsyncStorage y `precargarBranding()` lo lee
 * antes de que la app pinte nada (la puerta de `_layout` lo espera junto con
 * la sesión); el servidor se consulta igual, detrás, por si cambió. Y el logo
 * mismo lo dibuja `LogoDeLaEmpresa`, que trae una copia empaquetada para la
 * primera vez y deja la imagen en la caché de disco.
 */
let cached: Branding | null = null;
let inflight: Promise<Branding> | null = null;
const subscribers = new Set<(b: Branding) => void>();

function publish(b: Branding) {
  cached = b;
  for (const fn of subscribers) fn(b);
}

/** Lo guardado, antes del primer render. Nunca falla: sin nada, queda el respaldo. */
export async function precargarBranding(): Promise<void> {
  if (cached) return;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    if (crudo) publish(JSON.parse(crudo) as Branding);
  } catch {
    // Sin copia guardada se usa el respaldo empaquetado.
  }
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
      AsyncStorage.setItem(CLAVE, JSON.stringify(next)).catch(() => {});
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

/** Una vez por arranque: lo guardado se muestra ya, y esto lo pone al día. */
let consultado = false;

export function useBranding(): Branding {
  const [state, setState] = useState<Branding>(cached ?? FALLBACK);
  useEffect(() => {
    if (!consultado) {
      consultado = true;
      void fetchBranding();
    }
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);
  return state;
}

export function refreshBranding() {
  return fetchBranding();
}

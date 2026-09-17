import type { TokenPair } from "@vivero/shared";
import { API_BASE_URL } from "./config";
import { useAuthStore } from "./auth-store";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Cuánto se espera al servidor antes de darlo por inalcanzable.
 *
 * `fetch` no trae tiempo límite propio, y sin uno una dirección donde **nadie
 * contesta** —la IP de la LAN de ayer, después de que el router repartiera
 * otra— deja el botón girando cerca de un minuto y después falla con un error
 * que no nombra el problema. No es lo mismo que un puerto cerrado, que rebota
 * al instante: acá el paquete sale y no vuelve nada.
 *
 * Diez segundos alcanzan de sobra para cualquier pantalla de la app contra un
 * servidor que existe, y convierten "se quedó pensando" en una frase que dice
 * qué revisar.
 */
const ESPERA_MS = 10_000;

/**
 * `fetch` que se rinde a tiempo.
 *
 * Con `AbortController` y un `setTimeout`, no con `AbortSignal.timeout()`: en
 * React Native `AbortSignal` no es el del navegador sino el polyfill de
 * `abort-controller` (`setUpXHR.js` lo instala), y ese **no tiene** el estático
 * `timeout`. Usarlo no da un tiempo límite: da un `TypeError` en cada pedido de
 * la app.
 */
async function fetchConEspera(
  url: string,
  init: RequestInit
): Promise<Response> {
  const abortador = new AbortController();
  let vencio = false;
  const reloj = setTimeout(() => {
    vencio = true;
    abortador.abort();
  }, ESPERA_MS);
  try {
    return await fetch(url, { ...init, signal: abortador.signal });
  } catch {
    throw errorDeRed(vencio);
  } finally {
    clearTimeout(reloj);
  }
}

/** El error de no haber llegado al servidor, con la dirección a la que se fue. */
function errorDeRed(vencio: boolean): ApiError {
  return new ApiError(
    0,
    `No pudimos conectarnos al servidor (${API_BASE_URL}). ${
      vencio
        ? "No respondió a tiempo: revisa que la dirección sea la de esta red."
        : "Revisa tu conexión."
    }`
  );
}

/**
 * Qué se le muestra a quien está mirando la pantalla.
 *
 * `ApiError` trae el texto del servidor, que está escrito para leerse. De todo
 * lo demás —un error de JavaScript, el almacén seguro que se negó a guardar—
 * se mostraba **solo la frase de respaldo**, y esa frase esconde justo el dato
 * con el que se arregla el problema: "No pudimos iniciar sesión" dice lo mismo
 * para una contraseña equivocada que para un servidor mal apuntado.
 *
 * Así que la frase queda —es la que se entiende— y la causa va detrás, entre
 * paréntesis, para quien tenga que arreglarlo.
 */
export function mensajeDeError(e: unknown, respaldo: string): string {
  if (esApiError(e)) return e.message;
  if (e instanceof Error && e.message) return `${respaldo} (${e.message})`;
  return respaldo;
}

/**
 * Por forma y no con `instanceof`.
 *
 * Con Fast Refresh, editar este archivo lo vuelve a evaluar y define una clase
 * `ApiError` **nueva**; una pantalla que no se volvió a montar sigue comparando
 * contra la vieja, así que `instanceof` da `false` para un error que sí es
 * nuestro y la pantalla muestra la frase genérica en vez del mensaje del
 * servidor. Pasa solo en desarrollo, que es justo cuando uno está mirando el
 * mensaje para entender qué falló.
 */
function esApiError(e: unknown): e is ApiError {
  return (
    e instanceof Error &&
    typeof (e as { status?: unknown }).status === "number"
  );
}

let inflightRefresh: Promise<string | null> | null = null;

async function refreshOnce(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  inflightRefresh = (async () => {
    try {
      const res = await fetchConEspera(`${API_BASE_URL}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // El servidor rechazó el refresh: la sesión ya no vale y hay que
        // volver a entrar.
        await useAuthStore.getState().clear();
        return null;
      }
      const tokens = (await res.json()) as TokenPair;
      await useAuthStore.getState().setTokenPair(tokens);
      return tokens.accessToken;
    } catch (e) {
      // **No llegar al servidor no es lo mismo que ser rechazado.** Acá se
      // cerraba la sesión igual, así que un rato sin señal —un jardín con
      // paredes, la dirección del servidor mal puesta— dejaba a alguien
      // afuera, y sin señal tampoco podía volver a entrar. La sesión sigue
      // siendo válida: lo que falló fue el camino, y eso lo dice la pantalla.
      throw e;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  authenticated?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, authenticated = true } = options;

  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authenticated && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // Sin tiempo límite, una dirección muerta deja la pantalla girando: ver
    // el comentario de `ESPERA_MS`.
    return fetchConEspera(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let token = useAuthStore.getState().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && authenticated) {
    const newToken = await refreshOnce();
    if (newToken) {
      token = newToken;
      res = await doFetch(token);
    }
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Solicitud falló (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

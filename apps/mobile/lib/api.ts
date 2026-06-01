import type { TokenPair } from "@vivero/shared";
import { API_BASE_URL } from "./config";
import { useAuthStore } from "./auth-store";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

let inflightRefresh: Promise<string | null> | null = null;

async function refreshOnce(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await useAuthStore.getState().clear();
        return null;
      }
      const tokens = (await res.json()) as TokenPair;
      await useAuthStore.getState().setTokenPair(tokens);
      return tokens.accessToken;
    } catch {
      await useAuthStore.getState().clear();
      return null;
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
    return fetch(url, {
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

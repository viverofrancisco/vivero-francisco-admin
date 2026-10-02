import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "vivero.refreshToken";
/**
 * Quién es, junto al token. Sin esto la app sabía que había una sesión pero no
 * de quién, y al abrir pasaba por el login hasta que el servidor contestaba —
 * o, sin señal, no pasaba nunca.
 */
const USUARIO_KEY = "vivero.usuario";

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USUARIO_KEY).catch(() => {});
}

export async function getStoredUsuario<T>(): Promise<T | null> {
  try {
    const crudo = await SecureStore.getItemAsync(USUARIO_KEY);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

export async function setStoredUsuario(usuario: unknown): Promise<void> {
  await SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(usuario)).catch(() => {});
}

import { create } from "zustand";
import type { AuthUser, MeResponse, TokenPair, UserRole } from "@vivero/shared";
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from "./auth-storage";

export interface SessionUser {
  id: string;
  role: UserRole;
  name: string | null;
  apellido: string | null;
  email: string | null;
  personalId?: string | null;
  clienteId?: string | null;
}

interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;

  hydrate: () => Promise<void>;
  setSession: (tokens: TokenPair, user: AuthUser | MeResponse) => Promise<void>;
  setUser: (user: SessionUser) => void;
  setAccessToken: (token: string) => void;
  setTokenPair: (tokens: TokenPair) => Promise<void>;
  clear: () => Promise<void>;
}

function toSessionUser(u: AuthUser | MeResponse): SessionUser {
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    apellido: u.apellido,
    email: "email" in u ? u.email ?? null : null,
    personalId: "personalId" in u ? u.personalId : undefined,
    clienteId: "clienteId" in u ? u.clienteId : undefined,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const refreshToken = await getStoredRefreshToken();
    set({ hydrated: true, refreshToken });
  },

  setSession: async (tokens, user) => {
    await setStoredRefreshToken(tokens.refreshToken);
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: toSessionUser(user),
    });
  },

  setUser: (user) => set({ user }),

  setAccessToken: (token) => set({ accessToken: token }),

  setTokenPair: async (tokens) => {
    await setStoredRefreshToken(tokens.refreshToken);
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },

  clear: async () => {
    await clearStoredRefreshToken();
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));

import { z } from "zod";

export const userRoleSchema = z.enum([
  "ADMIN",
  "STAFF",
  "PERSONAL_ADMIN",
  "PERSONAL",
  "CLIENTE",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginSchema>;

// Clientes inician sesión con su teléfono o su correo (lo que tengan en su
// ficha) + una contraseña que ellos mismos establecen vía un enlace de invitación.
export const clienteLoginSchema = z.object({
  identifier: z.string().min(5).max(60),
  password: z.string().min(1),
});
export type ClienteLoginBody = z.infer<typeof clienteLoginSchema>;

// El cliente pide un enlace para crear/restablecer su contraseña; el enlace se
// envía al correo y/o WhatsApp registrados en su ficha.
export const requestInviteSchema = z.object({
  identifier: z.string().min(5).max(60),
});
export type RequestInviteBody = z.infer<typeof requestInviteSchema>;

// Establecer la contraseña a partir del token recibido en el enlace.
export const setPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6).max(72),
});
export type SetPasswordBody = z.infer<typeof setPasswordSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshBody = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutBody = RefreshBody;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string | null;
  apellido: string | null;
  email?: string | null;
}

export interface AuthSuccessResponse extends TokenPair {
  user: AuthUser;
}

export interface MeResponse {
  id: string;
  role: UserRole;
  name: string | null;
  apellido: string | null;
  email: string | null;
  personalId: string | null;
  clienteId: string | null;
}

export interface ApiError {
  error: string;
  retryAfter?: number;
}

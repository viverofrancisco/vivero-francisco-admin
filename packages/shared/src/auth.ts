import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "STAFF", "PERSONAL", "CLIENTE"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// El campo dice `email` por historia, pero acepta un correo **o** un usuario:
// quien trabaja en el jardín no tiene correo y entra con un nombre corto que le
// dictó un administrador. Por eso no se valida como dirección — el servidor
// decide por dónde buscar según tenga arroba o no.
export const loginSchema = z.object({
  email: z.string().min(3).max(120),
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
  /** Ver `MeResponse.usuario`. Opcional: el cliente entra por teléfono. */
  usuario?: string | null;
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
  /**
   * Con qué entra. Es lo que la oficina le dicta por teléfono al jardinero, que
   * no tiene correo, y lo primero que se olvida: la pantalla de Cuenta es donde
   * se va a buscar.
   */
  usuario: string | null;
  personalId: string | null;
  clienteId: string | null;
}

export interface ApiError {
  error: string;
  retryAfter?: number;
}

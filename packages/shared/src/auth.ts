import { z } from "zod";

export const userRoleSchema = z.enum([
  "ADMIN",
  "STAFF",
  "PERSONAL_ADMIN",
  "PERSONAL",
  "CLIENTE",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const otpRequestSchema = z.object({
  phone: z.string().min(7).max(20),
});
export type OtpRequestBody = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().regex(/^\d{6}$/, "Código inválido"),
});
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginSchema>;

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

export interface OtpRequestResponse {
  ok: true;
  expiresIn: number;
}

export interface ApiError {
  error: string;
  retryAfter?: number;
}

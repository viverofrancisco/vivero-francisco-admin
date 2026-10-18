import { z } from "zod";

export const pushRegisterSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().max(120).optional(),
  /** De qué app es el token (ver `PushToken.app`). */
  app: z.enum(["clientes", "equipo"]).optional(),
});
export type PushRegisterBody = z.infer<typeof pushRegisterSchema>;

export interface PushRegisterResponse {
  ok: true;
  id: string;
}

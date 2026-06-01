import { z } from "zod/v4";

export const sectorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
});

export type SectorFormData = z.infer<typeof sectorSchema>;

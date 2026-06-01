import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { BUCKET_NAME, s3 } from "@/lib/s3";

const SINGLETON_ID = "default";

export interface EmpresaConfig {
  id: string;
  nombre: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  updatedAt: Date;
}

export async function getEmpresaConfig(): Promise<EmpresaConfig> {
  const row = await prisma.empresaConfig.findUnique({
    where: { id: SINGLETON_ID },
  });
  return (
    row ?? {
      id: SINGLETON_ID,
      nombre: null,
      logoKey: null,
      logoUrl: null,
      updatedAt: new Date(),
    }
  );
}

export interface EmpresaConfigInput {
  nombre?: string | null;
  logoKey?: string | null;
  logoUrl?: string | null;
}

export async function updateEmpresaConfig(
  viewer: Viewer,
  input: EmpresaConfigInput
): Promise<EmpresaConfig> {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();

  // If we're replacing or clearing the logo, delete the old one from R2 first.
  // Best-effort: log and continue if it fails.
  if (input.logoKey !== undefined || input.logoUrl !== undefined) {
    const current = await prisma.empresaConfig.findUnique({
      where: { id: SINGLETON_ID },
      select: { logoKey: true },
    });
    if (current?.logoKey && current.logoKey !== input.logoKey) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: current.logoKey,
          })
        );
      } catch (err) {
        console.warn("Failed to delete old empresa logo from R2", err);
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (input.nombre !== undefined) {
    const trimmed = input.nombre?.trim() ?? "";
    data.nombre = trimmed.length > 0 ? trimmed : null;
  }
  if (input.logoKey !== undefined) data.logoKey = input.logoKey;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;

  return prisma.empresaConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

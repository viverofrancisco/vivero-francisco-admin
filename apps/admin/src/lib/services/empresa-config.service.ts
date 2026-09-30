import { randomUUID } from "crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { BUCKET_NAME, getUploadUrl, publicUrlForKey, s3 } from "@/lib/s3";

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

const TIPOS_DE_LOGO = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_BYTES_LOGO = 2 * 1024 * 1024;

/**
 * Una URL firmada para subir el logo. Estaba en la ruta del portal; con la
 * app subiendo el mismo logo, vive acá para que las dos pidan lo mismo.
 */
export async function urlParaSubirLogo(
  viewer: Viewer,
  archivo: { fileName: string; contentType: string; size?: number }
) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
  if (!TIPOS_DE_LOGO.has(archivo.contentType)) {
    throw new ValidationError("Formato no permitido. Usa PNG, JPG o WEBP.");
  }
  if (archivo.size !== undefined && archivo.size > MAX_BYTES_LOGO) {
    throw new ValidationError("Imagen demasiado grande (máx 2MB)");
  }
  const ext = (archivo.fileName.split(".").pop() || "png").toLowerCase();
  const key = `empresa/logo-${randomUUID()}.${ext}`;
  return {
    uploadUrl: await getUploadUrl(key, archivo.contentType),
    key,
    publicUrl: publicUrlForKey(key),
  };
}

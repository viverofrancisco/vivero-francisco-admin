import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3-compatible). Region is always "auto" for R2.
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET!;

// Public base URL where uploaded objects are served (r2.dev subdomain or
// custom CDN domain). Trailing slash trimmed so callers can join with `/key`.
const PUBLIC_URL_BASE = (process.env.S3_PUBLIC_URL_BASE ?? "").replace(/\/+$/, "");

export function publicUrlForKey(key: string): string {
  if (!PUBLIC_URL_BASE) {
    throw new Error("S3_PUBLIC_URL_BASE is not configured");
  }
  return `${PUBLIC_URL_BASE}/${key}`;
}

export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

export async function getDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { getUploadUrl, BUCKET_NAME } from "@/lib/s3";
import { z } from "zod/v4";
import { randomUUID } from "crypto";

const uploadRequestSchema = z.object({
  files: z.array(
    z.object({
      fileName: z.string().min(1),
      contentType: z.string().min(1),
    })
  ).min(1).max(10),
});

// POST - Get presigned upload URLs
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const visita = await prisma.visita.findUnique({ where: { id } });
  if (!visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const result = uploadRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const uploads = await Promise.all(
    result.data.files.map(async (file) => {
      const ext = file.fileName.split(".").pop() || "";
      const key = `visitas/${id}/${randomUUID()}.${ext}`;
      const uploadUrl = await getUploadUrl(key, file.contentType);
      const tipo = file.contentType.startsWith("video/") ? "video" : "imagen";

      return { key, uploadUrl, tipo, contentType: file.contentType };
    })
  );

  return NextResponse.json({ uploads });
}

// PUT - Confirm uploaded files (save to DB)
const confirmSchema = z.object({
  files: z.array(
    z.object({
      key: z.string().min(1),
      tipo: z.string().min(1),
    })
  ),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = confirmSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const region = process.env.AWS_REGION;
  const media = await prisma.visitaMedia.createManyAndReturn({
    data: result.data.files.map((f) => ({
      visitaId: id,
      key: f.key,
      url: `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${f.key}`,
      tipo: f.tipo,
    })),
  });

  return NextResponse.json(media, { status: 201 });
}

// GET - List media for a visit
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const media = await prisma.visitaMedia.findMany({
    where: { visitaId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(media);
}

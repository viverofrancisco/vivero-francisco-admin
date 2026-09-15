import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { prisma as db } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Quién puede tocar los archivos de esta visita.
 *
 * La oficina, y **el jardinero asignado**. `isReadOnly` lo deja afuera porque
 * en el portal no agenda, no edita y no cierra; pero las fotos se sacan
 * mientras se trabaja, y el que está en el jardín es él. Lo que lo habilita es
 * la asignación, no el rol: en la visita de otra cuadrilla sigue siendo de solo
 * lectura.
 */
async function puedeTocarArchivos(
  user: { id: string; role: UserRole; personalId?: string | null },
  visitaId: string
): Promise<boolean> {
  if (!isReadOnly(user.role)) return true;
  if (user.role !== "PERSONAL" || !user.personalId) return false;
  const asignado = await db.visitaPersonal.count({
    where: { visitaId, personalId: user.personalId, removedAt: null },
  });
  return asignado > 0;
}
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";
import { z } from "zod/v4";
import { requestUploadUrlsSchema } from "@vivero/shared";
import { randomUUID } from "crypto";

// El mismo schema que usa la app móvil: es la misma subida, y tenerlo dos
// veces ya había hecho que el web aceptara 10 archivos y el móvil 20.
const uploadRequestSchema = requestUploadUrlsSchema;

// POST - Get presigned upload URLs
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await puedeTocarArchivos(user, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

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
      // A qué tarea corresponde la foto. Opcional.
      tareaId: z.string().min(1).nullable().optional(),
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
  const { id } = await params;
  if (!(await puedeTocarArchivos(user, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await request.json();
  const result = confirmSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  // La etiqueta puede ser **cualquier tarea viva**, no solo una de las que se
  // cargaron en la visita: en el campo se fotografía lo que aparece —un
  // problema de riego durante una poda— y restringirla dejaba esas fotos sin
  // clasificar. El informe arma secciones con cualquier tarea.
  const permitidos = new Set(
    (
      await prisma.tarea.findMany({
        where: { deletedAt: null },
        select: { id: true },
      })
    ).map((t) => t.id)
  );

  const media = await prisma.visitaMedia.createManyAndReturn({
    data: result.data.files.map((f) => ({
      visitaId: id,
      key: f.key,
      url: publicUrlForKey(f.key),
      tipo: f.tipo,
      tareaId: f.tareaId && permitidos.has(f.tareaId) ? f.tareaId : null,
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

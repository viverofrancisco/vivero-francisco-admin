import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  generateInforme,
  listInformes,
} from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId") ?? undefined;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
  const to = toStr ? new Date(`${toStr}T00:00:00.000Z`) : undefined;
  const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);

  try {
    const result = await listInformes(viewerFromMobileUser(userOrResponse), {
      clienteId,
      from,
      to,
      offset,
      limit,
    });
    // Slim the payload for mobile.
    return NextResponse.json({
      items: result.items.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        fechaDesde: i.fechaDesde?.toISOString() ?? null,
        fechaHasta: i.fechaHasta?.toISOString() ?? null,
        pdfUrl: i.pdfUrl,
        generatedAt: i.generatedAt.toISOString(),
        cliente: {
          id: i.cliente.id,
          nombre: `${i.cliente.nombre} ${i.cliente.apellido ?? ""}`.trim(),
        },
        visitasCount: i._count.visitas,
      })),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const generateSchema = z.object({
  clienteId: z.string().min(1),
  titulo: z.string().min(1).max(200),
  visitaIds: z.array(z.string().min(1)).min(1),
  firmantes: z
    .array(
      z.object({
        nombre: z.string().min(1).max(100),
        cedula: z.string().max(30).nullable().optional(),
      })
    )
    .min(1)
    .max(3),
  secciones: z
    .array(
      z.object({
        tipoActividadId: z.string().nullable().optional(),
        titulo: z.string().min(1).max(200),
        descripcion: z.string().max(4000).nullable().optional(),
        mediaIds: z.array(z.string().min(1)),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = generateSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const result = await generateInforme(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

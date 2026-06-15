import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import {
  importClientes,
  type ImportRowResult,
} from "@/lib/services/cliente.service";
import { httpStatusForServiceError } from "@/lib/services/errors";

interface ImportBatchBody {
  rows?: unknown;
  importId?: string;
  offset?: number;
  total?: number;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Importación es solo para ADMIN/STAFF (igual que crear cliente en la web).
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as ImportBatchBody | null;
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Formato inválido: falta el arreglo 'rows'." },
      { status: 400 }
    );
  }

  const offset = typeof body?.offset === "number" ? body.offset : 0;

  try {
    const viewer = await viewerFromSession();
    const batch = await importClientes(viewer, rows as Record<string, unknown>[]);

    // Numerar las filas globalmente (el lote arranca en `offset`).
    const results: ImportRowResult[] = batch.results.map((r) => ({
      ...r,
      fila: r.fila + offset,
    }));

    // Crear el registro de historial (primer lote) o agregar al existente.
    let importId = body?.importId;
    if (!importId) {
      const record = await prisma.clienteImport.create({
        data: {
          createdById: user.id,
          status: "procesando",
          total: typeof body?.total === "number" ? body.total : rows.length,
          created: batch.created,
          skipped: batch.skipped,
          failed: batch.failed,
          results: results as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      importId = record.id;
    } else {
      const existing = await prisma.clienteImport.findFirst({
        where: { id: importId, createdById: user.id },
        select: { results: true, created: true, skipped: true, failed: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Importación no encontrada." },
          { status: 404 }
        );
      }
      const prev = (existing.results as unknown as ImportRowResult[]) ?? [];
      await prisma.clienteImport.update({
        where: { id: importId },
        data: {
          results: [...prev, ...results] as unknown as Prisma.InputJsonValue,
          created: existing.created + batch.created,
          skipped: existing.skipped + batch.skipped,
          failed: existing.failed + batch.failed,
        },
      });
    }

    return NextResponse.json({
      importId,
      results,
      created: batch.created,
      skipped: batch.skipped,
      failed: batch.failed,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al importar" },
      { status: httpStatusForServiceError(e) }
    );
  }
}

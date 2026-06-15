import { NextResponse } from "next/server";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import { importClientes } from "@/lib/services/cliente.service";
import { httpStatusForServiceError } from "@/lib/services/errors";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Importación es solo para ADMIN/STAFF (igual que crear cliente en la web).
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Formato inválido: falta el arreglo 'rows'." },
      { status: 400 }
    );
  }

  try {
    const viewer = await viewerFromSession();
    const result = await importClientes(viewer, rows as Record<string, unknown>[]);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al importar" },
      { status: httpStatusForServiceError(e) }
    );
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly, viewerFromSession } from "@/lib/auth-helpers";
import {
  bulkSoftDeleteClientes,
  hardDeleteClientes,
} from "@/lib/services/cliente.service";
import { httpStatusForServiceError } from "@/lib/services/errors";

const MAX_IDS = 500;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    hard?: boolean;
  } | null;

  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos un cliente." },
      { status: 400 }
    );
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_IDS} clientes por operación.` },
      { status: 400 }
    );
  }
  const cleanIds = ids.filter((id): id is string => typeof id === "string");

  // Hard delete: solo ADMIN y solo fuera de producción (herramienta de dev).
  if (body?.hard) {
    if (user.role !== "ADMIN" || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "El borrado permanente no está disponible." },
        { status: 403 }
      );
    }
  }

  try {
    const viewer = await viewerFromSession();
    const result = body?.hard
      ? await hardDeleteClientes(viewer, cleanIds)
      : await bulkSoftDeleteClientes(viewer, cleanIds);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al eliminar" },
      { status: httpStatusForServiceError(e) }
    );
  }
}

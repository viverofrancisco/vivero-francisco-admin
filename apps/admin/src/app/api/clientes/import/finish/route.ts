import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

// Marca una importación como completada o cancelada (se llama al final, o cuando
// el usuario cancela entre lotes). Las filas ya creadas se conservan.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    importId?: string;
    status?: string;
  } | null;

  const importId = body?.importId;
  const status = body?.status;
  if (!importId || (status !== "completado" && status !== "cancelado")) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await prisma.clienteImport.updateMany({
    where: { id: importId, createdById: user.id },
    data: { status },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "Importación no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

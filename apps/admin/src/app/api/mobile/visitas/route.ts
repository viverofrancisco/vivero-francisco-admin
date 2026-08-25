import { NextResponse } from "next/server";
import {
  createVisitasSchema,
  visitasListQuerySchema,
} from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  createVisitasBatch,
  listVisitas,
} from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF",
    "PERSONAL_ADMIN",
    "CLIENTE"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const parsed = visitasListQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    // CLIENTEs see their full history (past + future). Staff defaults to
    // today onward unless they pass an explicit `from` filter.
    const isCliente = userOrResponse.role === "CLIENTE";
    const result = await listVisitas(viewerFromMobileUser(userOrResponse), {
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit ?? (isCliente ? 200 : 50),
      defaultFromToday: !isCliente,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createVisitasSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const visitas = await createVisitasBatch(
      viewerFromMobileUser(userOrResponse),
      {
        clienteId: parsed.data.clienteId,
        productos: parsed.data.productos,
        fechas: parsed.data.fechas.map((f) => new Date(f)),
        grupoId: parsed.data.grupoId ?? null,
        notas: parsed.data.notas ?? null,
        personalIds: parsed.data.personalIds ?? [],
      }
    );
    return NextResponse.json(visitas, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

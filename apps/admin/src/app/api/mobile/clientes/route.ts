import { NextResponse } from "next/server";
import { createClienteSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  createCliente,
  listClientes,
} from "@/lib/services/cliente.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const result = await listClientes(viewerFromMobileUser(userOrResponse), {
      search,
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  // PERSONAL_ADMIN can create within their sectors; STAFF is read-only.
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createClienteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const cliente = await createCliente(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

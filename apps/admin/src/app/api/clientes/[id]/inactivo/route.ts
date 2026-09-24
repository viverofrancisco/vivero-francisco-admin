import { NextResponse } from "next/server";
import { clienteInactivoSchema } from "@vivero/shared";
import { viewerFromSession } from "@/lib/auth-helpers";
import { marcarClienteInactivo } from "@/lib/services/cliente.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Marcar un cliente como inactivo, o reactivarlo. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = clienteInactivoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await marcarClienteInactivo(await viewerFromSession(), id, parsed.data.inactivo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { fusionarClientes, vistaPreviaFusion } from "@/lib/services/cliente-fusion.service";

const schema = z.object({
  /** La ficha duplicada, que se absorbe en esta. */
  otroId: z.string().min(1),
  /** Sin esto solo devuelve qué se movería. */
  confirmar: z.boolean().optional(),
});

/** Fusionar otra ficha en esta. Ver `cliente-fusion.service.ts`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    const viewer = await viewerFromSession();
    const r = parsed.data.confirmar
      ? await fusionarClientes(viewer, id, parsed.data.otroId)
      : await vistaPreviaFusion(viewer, id, parsed.data.otroId);
    return NextResponse.json(r);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  guardarBorrador,
  listarBorradores,
} from "@/lib/services/informe-borrador.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const schema = z.object({
  /** Con id se pisa el que hay; sin id, es uno nuevo. */
  id: z.string().min(1).nullable().optional(),
  clienteId: z.string().min(1).nullable().optional(),
  /** Si es la edición de un informe, cuál. */
  informeId: z.string().min(1).nullable().optional(),
  titulo: z.string().max(200).nullable().optional(),
  /**
   * El estado del asistente, tal cual. No se valida contra el schema del
   * informe a propósito: un borrador está a medio llenar por definición, y
   * exigirle lo que se le exige a uno terminado lo haría imposible de guardar
   * justo cuando hace falta.
   */
  contenido: z.unknown(),
});

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    return NextResponse.json({ borradores: await listarBorradores(viewer) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id, ...input } = parsed.data;
  try {
    return NextResponse.json(await guardarBorrador(viewer, input, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

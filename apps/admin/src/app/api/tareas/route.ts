import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { createTarea, listTareas } from "@/lib/services/tarea.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    const items = await listTareas(viewer);
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const createSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const item = await createTarea(viewer, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

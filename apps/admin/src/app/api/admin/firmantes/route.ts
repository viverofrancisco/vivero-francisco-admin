import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  createFirmante,
  listFirmantes,
} from "@/lib/services/firmante.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET() {
  await viewerFromSession();
  const items = await listFirmantes();
  return NextResponse.json({ items });
}

const createSchema = z.object({
  nombre: z.string().min(1).max(100),
  cedula: z.string().max(30).nullable().optional(),
  isDefault: z.boolean().optional(),
  orden: z.number().int().optional(),
});

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = createSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const item = await createFirmante(viewer, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

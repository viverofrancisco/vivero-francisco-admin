import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { getMediaPoolDeVisitas } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const schema = z.object({
  visitaIds: z.array(z.string().min(1)).min(1).max(200),
});

// POST so we don't blow the URL length when many visita IDs are passed.
export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const items = await getMediaPoolDeVisitas(viewer, parsed.data.visitaIds);
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

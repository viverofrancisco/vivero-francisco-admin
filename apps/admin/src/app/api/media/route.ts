import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  confirmarSubida,
  listarMedia,
  urlsParaSubir,
} from "@/lib/services/media.service";
import { confirmarMediaSchema, subirMediaSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** La biblioteca, lo último primero. `?q=` busca por nombre. */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({ media: await listarMedia(viewer, { search: q }) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 1: URLs firmadas. El navegador sube directo a R2. */
export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = subirMediaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({
      uploads: await urlsParaSubir(viewer, parsed.data.files),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 2: anotar en la biblioteca lo que efectivamente llegó a R2. */
export async function PUT(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = confirmarMediaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      media: await confirmarSubida(viewer, parsed.data.archivos),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

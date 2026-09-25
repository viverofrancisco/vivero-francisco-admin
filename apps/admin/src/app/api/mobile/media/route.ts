import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  confirmarSubida,
  listarMedia,
  urlsParaSubir,
} from "@/lib/services/media.service";
import {
  confirmarMediaSchema,
  subirMediaSchema,
} from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La biblioteca de imágenes desde la app: el gemelo de `/api/media`, para el
 * selector de fotos del informe. Lo que la app sube entra acá, como en el
 * portal, y no colgado del informe: así se puede reusar, recortar y
 * encontrar después.
 */

/** La biblioteca, lo último primero. `?q=` busca por nombre. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({
      media: await listarMedia(viewerFromMobileUser(userOrResponse), {
        search: q,
      }),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 1: URLs firmadas. El teléfono sube directo a R2. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = subirMediaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({
      uploads: await urlsParaSubir(
        viewerFromMobileUser(userOrResponse),
        parsed.data.files
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 2: anotar en la biblioteca lo que efectivamente llegó a R2. */
export async function PUT(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = confirmarMediaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      media: await confirmarSubida(
        viewerFromMobileUser(userOrResponse),
        parsed.data.archivos
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

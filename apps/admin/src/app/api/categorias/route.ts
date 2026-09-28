import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  crearCategoria,
  listarCategorias,
} from "@/lib/services/categoria.service";
import { categoriaSchema } from "@/lib/validations/categoria";
import { publicUrlForKey } from "@/lib/s3";

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    // Con la url de la foto resuelta: la lista del teléfono la dibuja.
    const categorias = await listarCategorias(viewer);
    return NextResponse.json(
      categorias.map((c) => ({
        ...c,
        imagenUrl: c.media ? publicUrlForKey(c.media.key) : null,
      }))
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = categoriaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await crearCategoria(viewer, parsed.data), {
      status: 201,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

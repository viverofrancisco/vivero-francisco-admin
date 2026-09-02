import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  crearCategoria,
  listarCategorias,
} from "@/lib/services/categoria.service";
import { categoriaSchema } from "@/lib/validations/categoria";

export async function GET() {
  const viewer = await viewerFromSession();
  try {
    return NextResponse.json(await listarCategorias(viewer));
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

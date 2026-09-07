import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  agregarProductos,
  productosParaAgregar,
} from "@/lib/services/categoria.service";
import { agregarProductosSchema } from "@/lib/validations/categoria";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Los que **todavía no** están en la categoría. `?q=` busca por nombre. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({
      productos: await productosParaAgregar(viewer, id, q),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Suma productos a la categoría. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = agregarProductosSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await agregarProductos(viewer, id, parsed.data.productoIds)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

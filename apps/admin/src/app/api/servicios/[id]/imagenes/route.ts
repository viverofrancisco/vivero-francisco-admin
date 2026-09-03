import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  confirmarImagenes,
  listarImagenes,
  reordenarImagenes,
  urlsParaSubir,
} from "@/lib/services/producto-imagen.service";
import {
  confirmarImagenesSchema,
  imagenesSchema,
  reordenarImagenesSchema,
} from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Las fotos del producto, en orden. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json({ imagenes: await listarImagenes(viewer, id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 1: URLs firmadas. El navegador sube directo a R2. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = imagenesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({
      uploads: await urlsParaSubir(viewer, id, parsed.data.files),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Paso 2: confirmar lo que efectivamente llegó a R2. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = confirmarImagenesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await confirmarImagenes(viewer, id, parsed.data.imagenes),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Reordena: la primera es la que se muestra por defecto. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = reordenarImagenesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await reordenarImagenes(viewer, id, parsed.data.ids),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

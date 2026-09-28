import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  agregarImagenes,
  listarImagenes,
  reordenarImagenes,
} from "@/lib/services/producto-imagen.service";
import {
  agregarImagenesSchema,
  reordenarImagenesSchema,
} from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Las fotos del producto desde la app: la gemela de
 * `/api/servicios/[id]/imagenes`, por los mismos servicios.
 *
 * Subir un archivo es otra cosa y vive en `/api/mobile/media`: acá solo se
 * dice cuáles de las que ya están en la biblioteca usa este producto, y en
 * qué orden. La app guarda cada gesto en el acto —agregar, poner primera,
 * quitar— como hace Shopify con sus medios, así que no hay un `PUT` de la
 * galería entera como en el portal.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    return NextResponse.json({
      imagenes: await listarImagenes(viewerFromMobileUser(userOrResponse), id),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Suma imágenes de la biblioteca al producto, al final de la galería. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = agregarImagenesSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await agregarImagenes(
        viewerFromMobileUser(userOrResponse),
        id,
        parsed.data.mediaIds
      ),
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
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = reordenarImagenesSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      imagenes: await reordenarImagenes(
        viewerFromMobileUser(userOrResponse),
        id,
        parsed.data.ids
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

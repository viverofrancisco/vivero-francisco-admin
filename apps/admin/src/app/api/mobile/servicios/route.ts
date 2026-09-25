import { NextResponse } from "next/server";
import { createServicioSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  createServicio,
  listServicios,
} from "@/lib/services/servicio.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { textoPlano } from "@/lib/html-seguro";
import { publicUrlForKey } from "@/lib/s3";

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const result = await listServicios(viewerFromMobileUser(userOrResponse), {
      search,
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    // Aplanado para la fila del teléfono, igual que lo hace la página del
    // portal: la app no tiene por qué saber que el stock es la suma de las
    // variantes que se cuentan.
    return NextResponse.json({
      nextCursor: result.nextCursor,
      items: result.items.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        descripcion: textoPlano(p.descripcion),
        ivaTasa: p.ivaTasa,
        estado: p.estado,
        archivadoEl: p.deletedAt?.toISOString() ?? null,
        categorias: p.categorias.map((c) => c.categoria),
        // `null` = no cuenta stock, que no es lo mismo que tener cero.
        stock: p.variantes.some((v) => v.manejaInventario)
          ? p.variantes
              .filter((v) => v.manejaInventario)
              .reduce((n, v) => n + v.stock, 0)
          : null,
        variantes: p.variantes.length,
        imagenUrl: p.imagenes[0]
          ? publicUrlForKey(p.imagenes[0].media.key)
          : null,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createServicioSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const servicio = await createServicio(
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(servicio, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

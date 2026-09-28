import { NextResponse } from "next/server";
import { updateServicioSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  getServicio,
  updateServicio,
} from "@/lib/services/servicio.service";
import { getCatalogoDelProducto } from "@/lib/services/variante.service";
import { listarImagenes } from "@/lib/services/producto-imagen.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { textoPlano } from "@/lib/html-seguro";

/**
 * La ficha entera del producto, la misma que arma la página del portal:
 * el producto, sus categorías, su galería, sus ejes y sus variantes con
 * todo lo suyo (SKU, precio, costo, peso, stock). Devolvía nombre,
 * descripción y tipo, y la app mostraba una ficha a medio hacer.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  const viewer = viewerFromMobileUser(userOrResponse);
  try {
    const servicio = await getServicio(id, viewer);
    const [catalogo, imagenes] = await Promise.all([
      getCatalogoDelProducto(viewer, id),
      listarImagenes(viewer, id),
    ]);
    const urlDeImagen = new Map(imagenes.map((i) => [i.id, i.url]));
    return NextResponse.json({
      id: servicio.id,
      nombre: servicio.nombre,
      // La app escribe y muestra texto plano; el HTML del editor del portal
      // se aplana como en la lista.
      descripcion: textoPlano(servicio.descripcion),
      tipo: servicio.tipo,
      estado: servicio.estado,
      ivaTasa: servicio.ivaTasa,
      createdAt: servicio.createdAt.toISOString(),
      categorias: servicio.categorias,
      // Con el `mediaId`: es con lo que el selector de la biblioteca sabe
      // cuáles ya están en el producto.
      imagenes: imagenes.map((i) => ({ id: i.id, mediaId: i.mediaId, url: i.url })),
      // Los valores viajan **con su id**: la app los devuelve al editar, y
      // sin el id renombrar "Rojo" sería borrar un valor y crear otro.
      opciones: catalogo.opciones.map((o) => ({
        id: o.id,
        nombre: o.nombre,
        valores: o.valores.map((v) => ({ id: v.id, valor: v.valor })),
      })),
      variantes: catalogo.variantes.map((v) => ({
        id: v.id,
        /** "Rojo · Grande", o el nombre del producto en la variante única. */
        nombre: v.valores.map((x) => x.valor).join(" · ") || servicio.nombre,
        /** Qué valor de cada eje: "Color → Rojo". */
        valores: v.valores.map((x) => ({ opcion: x.opcion, valor: x.valor })),
        sku: v.sku,
        precio: v.precio,
        cobraIva: v.cobraIva,
        costo: v.costo,
        peso: v.peso,
        pesoUnidad: v.pesoUnidad,
        manejaInventario: v.manejaInventario,
        stock: v.stock,
        permiteNegativo: v.permiteNegativo,
        /** Cuál de las fotos del producto eligió; `null` es la principal. */
        imagenId: v.imagenId,
        imagenUrl:
          (v.imagenId ? urlDeImagen.get(v.imagenId) : undefined) ??
          imagenes[0]?.url ??
          null,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ADMIN y STAFF, como en el portal: el servicio ya lo exige por su cuenta.
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = updateServicioSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const servicio = await updateServicio(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data
    );
    return NextResponse.json(servicio);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

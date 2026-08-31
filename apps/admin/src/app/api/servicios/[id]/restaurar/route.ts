import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Devuelve un producto archivado al catálogo.
 *
 * Archivar es un borrado suave (`deletedAt`) porque el producto sigue nombrado
 * en visitas, órdenes y facturas viejas; sin esta puerta, la única forma de
 * deshacerlo era tocar la base a mano.
 *
 * No toca el vínculo con Contífico: si mientras estaba archivado alguien tomó
 * ese producto de allá para otro del portal, vuelve sin vincular, que es la
 * verdad. Vincularlo de nuevo es un paso aparte y explícito.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const producto = await prisma.producto.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (!producto.deletedAt) {
    return NextResponse.json(
      { error: "Este producto no está archivado" },
      { status: 409 }
    );
  }

  await prisma.producto.update({ where: { id }, data: { deletedAt: null } });
  return NextResponse.json({ message: "Producto restaurado" });
}

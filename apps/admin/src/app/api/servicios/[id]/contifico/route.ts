import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ContificoError } from "@/lib/contifico/client";
import {
  desvincularProducto,
  sincronizarProducto,
  vincularProducto,
} from "@/lib/contifico/productos";

/**
 * Con `contificoProductoId` vincula a un producto que ya existe en Contífico;
 * sin cuerpo, lo crea. Vincular es lo preferido: no escribe en su catálogo, y
 * Contífico no permite borrar productos, solo desactivarlos.
 */
const vincularSchema = z.object({
  contificoProductoId: z.string().min(1),
  codigo: z.string().min(1),
  /**
   * Renombrar el producto en Contífico para que coincida con el del portal.
   * La factura imprime el nombre que ellos tienen guardado, no el nuestro.
   */
  actualizarNombre: z.boolean().optional(),
});

async function soloAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo un administrador puede sincronizar con Contífico" },
      { status: 403 }
    );
  }
  return null;
}

function errorResponse(error: unknown) {
  if (error instanceof ContificoError) {
    return NextResponse.json(
      { error: error.status === 409 ? error.message : `Contífico: ${error.message}` },
      { status: error.status === 409 ? 409 : 502 }
    );
  }
  return NextResponse.json(
    { error: "No pudimos sincronizar con Contífico" },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denegado = await soloAdmin();
  if (denegado) return denegado;

  const { id } = await params;
  const producto = await prisma.producto.findUnique({
    where: { id, deletedAt: null },
  });
  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = vincularSchema.safeParse(body);

  try {
    if (parsed.success) {
      return NextResponse.json(
        await vincularProducto(
          id,
          {
            id: parsed.data.contificoProductoId,
            codigo: parsed.data.codigo,
          },
          { actualizarNombre: parsed.data.actualizarNombre }
        )
      );
    }
    // Sin cuerpo válido: se crea uno nuevo en Contífico. `forzar` para que el
    // "crear nuevo" del diálogo de cambio no devuelva el vínculo que ya había.
    const contificoProductoId = await sincronizarProducto(producto, true);
    const actualizado = await prisma.producto.findUniqueOrThrow({
      where: { id },
      select: { codigo: true },
    });
    return NextResponse.json({ ...actualizado, contificoProductoId });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Deshace el vínculo. No toca el producto en Contífico. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denegado = await soloAdmin();
  if (denegado) return denegado;

  const { id } = await params;
  try {
    await desvincularProducto(id);
    return NextResponse.json({ codigo: null, contificoProductoId: null });
  } catch (error) {
    return errorResponse(error);
  }
}

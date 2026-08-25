import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ContificoError } from "@/lib/contifico/client";
import { buscarProductos, MIN_BUSQUEDA } from "@/lib/contifico/productos";

/**
 * Busca en el catálogo de Contífico para vincular a mano.
 *
 * Exige `MIN_BUSQUEDA` caracteres: un filtro muy amplio hace que su API intente
 * devolver el catálogo entero y haga timeout a los 240s.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_BUSQUEDA) {
    return NextResponse.json({ items: [], minimo: MIN_BUSQUEDA });
  }

  try {
    const encontrados = await buscarProductos(q);
    // Los que ya están tomados por otro producto del portal se marcan, no se
    // esconden: si no, el usuario los busca y no entiende por qué no aparecen.
    const vinculados = await prisma.producto.findMany({
      where: {
        contificoProductoId: { in: encontrados.map((p) => p.id) },
        deletedAt: null,
      },
      select: { nombre: true, contificoProductoId: true },
    });
    const porId = new Map(
      vinculados.map((v) => [v.contificoProductoId, v.nombre])
    );

    return NextResponse.json({
      items: encontrados.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        tipo: p.tipo,
        estado: p.estado,
        vinculadoA: porId.get(p.id) ?? null,
      })),
      minimo: MIN_BUSQUEDA,
    });
  } catch (error) {
    if (error instanceof ContificoError) {
      return NextResponse.json(
        { error: `Contífico: ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "No pudimos consultar Contífico" },
      { status: 500 }
    );
  }
}

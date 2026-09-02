import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ContificoError } from "@/lib/contifico/client";
import { listarCategorias } from "@/lib/contifico/productos";

/**
 * Busca entre las categorías de Contífico, para elegir con cuál se crean los
 * productos de una categoría del portal.
 *
 * Filtra en el servidor y corta el resultado: `GET /categoria/` devuelve el
 * árbol entero sin filtros —2.939 en la cuenta de pruebas, casi todas de otros
 * integradores— y mandar eso al navegador es medio megabyte para elegir una.
 *
 * Se muestran con la ruta completa ("Ventas › Servicios") porque los nombres se
 * repiten: en esa misma cuenta hay cinco categorías llamadas "General".
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const todas = await listarCategorias();
    const porId = new Map(todas.map((c) => [c.id, c]));
    const ruta = (id: string | null): string => {
      const c = id ? porId.get(id) : null;
      if (!c) return "";
      const padre = c.padre_id ? ruta(c.padre_id) : "";
      return padre ? `${padre} › ${c.nombre}` : c.nombre;
    };

    const items = todas
      .map((c) => ({ id: c.id, nombre: c.nombre, ruta: ruta(c.id) }))
      .filter((c) => (q ? c.ruta.toLowerCase().includes(q) : true))
      .sort((a, b) => a.ruta.localeCompare(b.ruta))
      .slice(0, 50);

    return NextResponse.json({ items, total: todas.length });
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

import { NextResponse } from "next/server";
import { informeGenerateSchema } from "@/lib/validations/informe";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  generateInforme,
  listInformesYBorradores,
  type EstadoInformeFiltro,
} from "@/lib/services/informe.service";
import { serializarInformeItem } from "@/lib/informes/lista";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Las tandas siguientes del listado, para el scroll infinito de móvil.
 *
 * Devuelve **lo mismo** que pinta la página —informes y borradores en una sola
 * lista, con los mismos filtros— porque es su continuación: si acá saliera
 * otra cosa, scrollear cambiaría la lista a mitad de camino.
 */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("clienteId") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : undefined;
  const to = toStr ? new Date(`${toStr}T00:00:00.000Z`) : undefined;
  const estadoParam = url.searchParams.get("estado");
  const estado: EstadoInformeFiltro | undefined =
    estadoParam === "borrador" || estadoParam === "emitido"
      ? estadoParam
      : undefined;
  const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(url.searchParams.get("limit") ?? 20) || 20;
  try {
    const { items, total } = await listInformesYBorradores(viewer, {
      clienteId,
      q,
      from,
      to,
      estado,
      offset,
      limit,
    });
    return NextResponse.json({
      items: items.map(serializarInformeItem),
      total,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const generateSchema = informeGenerateSchema;

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = generateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const result = await generateInforme(viewer, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

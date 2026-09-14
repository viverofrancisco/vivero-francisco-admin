import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { parteVisitaSchema } from "@/lib/validations/visita";
import { borrarParte, registrarParte } from "@/lib/services/visita.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Guardar el parte de alguien. Ver la ruta móvil: los permisos los pone el servicio. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const parsed = parteVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    return NextResponse.json(await registrarParte(id, viewer, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Borrar el parte de alguien: vuelve a quedar como que no cargó nada.
 *
 * Un parte cargado en la visita equivocada no se arregla editándolo —hay que
 * sacarlo— y "falta que cargue" tiene que poder volver a ser verdad.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const personalId = new URL(request.url).searchParams.get("personalId");
  if (!personalId) {
    return NextResponse.json(
      { error: "Falta decir de quién es el parte." },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    return NextResponse.json(await borrarParte(id, viewer, personalId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

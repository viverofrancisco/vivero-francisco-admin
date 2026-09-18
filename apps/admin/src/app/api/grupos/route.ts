import { NextResponse } from "next/server";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import { grupoSchema } from "@/lib/validations/grupo";
import { crearGrupo, listGrupos } from "@/lib/services/grupo.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Las cuadrillas viven en `grupo.service`, que es de donde las pide la app. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listGrupos(await viewerFromSession()));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = grupoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const grupo = await crearGrupo(await viewerFromSession(), parsed.data);
    return NextResponse.json(grupo, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

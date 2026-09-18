import { NextResponse } from "next/server";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import { grupoSchema } from "@/lib/validations/grupo";
import {
  actualizarGrupo,
  archivarGrupo,
  getGrupo,
} from "@/lib/services/grupo.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await getGrupo(await viewerFromSession(), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
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
  const { id } = await params;
  try {
    return NextResponse.json(
      await actualizarGrupo(await viewerFromSession(), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await archivarGrupo(await viewerFromSession(), id);
    return NextResponse.json({ message: "Grupo archivado" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

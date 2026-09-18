import { NextResponse } from "next/server";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import { personalSchema } from "@/lib/validations/personal";
import {
  actualizarPersonal,
  archivarPersonal,
  getPersonal,
} from "@/lib/services/personal.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await getPersonal(await viewerFromSession(), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = personalSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await actualizarPersonal(await viewerFromSession(), id, parsed.data)
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
    await archivarPersonal(await viewerFromSession(), id);
    return NextResponse.json({ message: "Personal archivado" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

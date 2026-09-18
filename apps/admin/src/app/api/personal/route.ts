import { NextResponse } from "next/server";
import { getCurrentUser, viewerFromSession } from "@/lib/auth-helpers";
import { personalSchema } from "@/lib/validations/personal";
import { crearPersonal, listPersonal } from "@/lib/services/personal.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * La ficha y su cuenta viven en `personal.service`, que es de donde también
 * las pide la app. Estaban escritas acá adentro, con `prisma` a mano, y crear
 * un jardinero en dos lugares distintos es la forma más rápida de que uno de
 * los dos se olvide de crearle la cuenta.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listPersonal(await viewerFromSession()));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
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
  try {
    const personal = await crearPersonal(await viewerFromSession(), parsed.data);
    return NextResponse.json(personal, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

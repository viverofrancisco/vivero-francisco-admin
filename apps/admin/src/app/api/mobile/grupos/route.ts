import { NextResponse } from "next/server";
import { grupoSchema } from "@/lib/validations/grupo";
import { requireMobileUser, requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { crearGrupo, listGrupos } from "@/lib/services/grupo.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Las cuadrillas.
 *
 * La respuesta trae `miembrosIds` además de los miembros: el asistente de
 * visitas elige un grupo y marca a su gente, y con solo los objetos anidados
 * cada pantalla tenía que volver a aplanarlos.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const grupos = await listGrupos(viewerFromMobileUser(userOrResponse));
    return NextResponse.json({
      items: grupos.map((g) => ({
        ...g,
        miembrosIds: g.miembros.map((m) => m.personalId),
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = grupoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const grupo = await crearGrupo(viewerFromMobileUser(userOrResponse), parsed.data);
    return NextResponse.json(grupo, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

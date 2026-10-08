import { NextResponse } from "next/server";
import { crearSolicitudSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import {
  crearSolicitud,
  listarSolicitudes,
  type FiltroSolicitudes,
} from "@/lib/services/solicitud.service";

const ESTADOS: FiltroSolicitudes[] = ["pendientes", "atendidas", "todas"];

/** El cliente ve las suyas; administradores y staff, todas. */
export async function GET(request: Request) {
  const user = await requireMobileUser(request);
  if (!isMobileUser(user)) return user;
  const url = new URL(request.url);
  const estado = url.searchParams.get("estado") as FiltroSolicitudes | null;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  try {
    return NextResponse.json(
      await listarSolicitudes(viewerFromMobileUser(user), {
        estado: estado && ESTADOS.includes(estado) ? estado : undefined,
        offset: Number.isFinite(offset) ? offset : 0,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await requireMobileUser(request);
  if (!isMobileUser(user)) return user;
  const parsed = crearSolicitudSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await crearSolicitud(viewerFromMobileUser(user), parsed.data),
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import {
  createVisitasSchema,
  visitasListQuerySchema,
} from "@vivero/shared";
import {
  requireMobileRole,
  requireMobileUser,
  isMobileUser,
} from "@/lib/mobile/auth";
import {
  createVisitasBatch,
  listVisitas,
} from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Las visitas de quien pregunta.
 *
 * Sin lista de roles: `listVisitas` ya limita por viewer —la oficina las ve
 * todas, el cliente las suyas, el jardinero **aquellas donde está asignado**—.
 * Acá había una lista que nombraba ADMIN, STAFF y CLIENTE y se olvidaba de
 * PERSONAL: resto de cuando reportaba el capataz por todo el grupo. El
 * jardinero recibía 403 y la app le mostraba "No hay visitas", que es la
 * peor forma de fallar: parece un dato, no un error.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const parsed = visitasListQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    clienteId: url.searchParams.get("clienteId") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    // El cliente ve su historial entero —entra a mirar lo que ya se hizo— y
    // todos los demás arrancan en hoy, salvo que pidan otra cosa: al jardinero
    // y a la oficina lo que les importa es lo que viene.
    // Pedidas por cliente vienen **todas** sus fechas: se piden para marcar
    // cuáles cubre una orden, y cobrar el mes pasado es lo normal.
    const isCliente = userOrResponse.role === "CLIENTE";
    const porCliente = parsed.data.clienteId !== undefined;
    const result = await listVisitas(viewerFromMobileUser(userOrResponse), {
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      clienteId: parsed.data.clienteId,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit ?? (isCliente || porCliente ? 200 : 50),
      defaultFromToday: !isCliente && !porCliente,
    });
    return NextResponse.json(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createVisitasSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const visitas = await createVisitasBatch(
      viewerFromMobileUser(userOrResponse),
      {
        clienteId: parsed.data.clienteId,
        propiedadId: parsed.data.propiedadId,
        tareasObligatoriasIds: parsed.data.tareasObligatoriasIds,
        // El asistente de la app la manda y se perdía acá: la visita
        // agendada desde un plan quedaba sin plan.
        suscripcionId: parsed.data.suscripcionId ?? null,
        fechas: parsed.data.fechas.map((f) => new Date(f)),
        grupoId: parsed.data.grupoId ?? null,
        notas: parsed.data.notas ?? null,
        personalIds: parsed.data.personalIds ?? [],
      }
    );
    return NextResponse.json(visitas, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

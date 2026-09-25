import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { propiedadesDeVisitas } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  deleteInforme,
  editarInforme,
  getInforme,
} from "@/lib/services/informe.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { informeGenerateSchema } from "@/lib/validations/informe";
import { esFotosPorFila } from "@/lib/informes/template-data";

/**
 * La ficha del informe para la app: lo que el portal muestra en la suya y
 * lo que su asistente necesita para **reabrirlo** —el encabezado, la fecha
 * impresa, las secciones con sus fotos y su layout, los firmantes y las
 * visitas—, porque la app también edita.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    const informe = await getInforme(viewerFromMobileUser(userOrResponse), id);
    const nombreDeCuenta = (
      c: { name: string | null; apellido: string | null } | null
    ) => (c ? `${c.name ?? ""} ${c.apellido ?? ""}`.trim() || null : null);
    // `firmantes` es JSON: lo que hay adentro no lo garantiza el esquema.
    const firmantes = (
      Array.isArray(informe.firmantes)
        ? (informe.firmantes as Array<{ nombre?: unknown; cedula?: unknown }>)
        : []
    )
      .filter((f) => typeof f?.nombre === "string" && f.nombre.length > 0)
      .map((f) => ({
        nombre: f.nombre as string,
        cedula: typeof f.cedula === "string" ? f.cedula : null,
      }));
    const visitas = informe.visitas
      .filter((v) => v.visita != null)
      .map((v) => v.visita);
    return NextResponse.json({
      id: informe.id,
      numero: informe.numero,
      versionActual: informe.versionActual,
      titulo: informe.titulo,
      encabezado: informe.encabezado,
      fecha: informe.fecha.toISOString().slice(0, 10),
      fechaDesde: informe.fechaDesde?.toISOString() ?? null,
      fechaHasta: informe.fechaHasta?.toISOString() ?? null,
      pdfUrl: informe.pdfUrl,
      generatedAt: informe.generatedAt.toISOString(),
      generadoPor:
        informe.generatedByNombre || nombreDeCuenta(informe.generatedBy) || null,
      // Solo si alguien lo editó de verdad: `updatedAt` se mueve con
      // cualquier escritura, así que sin `updatedById` no dice nada.
      actualizadoEl: informe.updatedById ? informe.updatedAt.toISOString() : null,
      actualizadoPor: informe.updatedById
        ? informe.updatedByNombre || nombreDeCuenta(informe.updatedBy) || null
        : null,
      cliente: {
        id: informe.cliente.id,
        nombre: informe.cliente.nombre,
        apellido: informe.cliente.apellido,
        empresa: informe.cliente.empresa,
      },
      visitasCount: visitas.length,
      visitas: visitas.map((v) => ({
        id: v.id,
        numero: v.numero,
        estado: v.estado,
        fecha: (v.fechaRealizada ?? v.fechaProgramada).toISOString(),
        propiedad: v.propiedad?.nombre ?? null,
      })),
      propiedades: propiedadesDeVisitas(visitas).map((p) => p.nombre),
      firmantes,
      secciones: informe.secciones.map((s) => ({
        tareaId: s.tareaId,
        titulo: s.titulo,
        descripcion: s.descripcion ?? "",
        saltoDePagina: s.saltoDePagina,
        fotosPorFila: esFotosPorFila(s.fotosPorFila) ? s.fotosPorFila : 3,
        fotosAlineacion: s.fotosAlineacion,
        fotos: s.fotos.map((f) => ({
          visitaMediaId: f.visitaMediaId,
          mediaId: f.mediaId,
          url: f.url,
        })),
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Igual que generar, más la nota de qué se cambió: la gemela del PUT del portal. */
const editarSchema = informeGenerateSchema.extend({
  nota: z.string().max(500).nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = editarSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const { nota, ...payload } = parsed.data;
    return NextResponse.json(
      await editarInforme(viewerFromMobileUser(userOrResponse), id, payload, nota)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    await deleteInforme(viewerFromMobileUser(userOrResponse), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

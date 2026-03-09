import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserSectorIds, isReadOnly } from "@/lib/auth-helpers";
import { generarVisitasSchema } from "@/lib/validations/visita";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = generarVisitasSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const { mes, anio } = result.data;
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const inicioMes = new Date(anio, mes - 1, 1);
  const finMes = new Date(anio, mes, 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asignacionesWhere: any = { estado: "ACTIVO" };

  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    asignacionesWhere.cliente = { sectorId: { in: sectorIds } };
  }

  const asignaciones = await prisma.clienteServicio.findMany({
    where: asignacionesWhere,
    include: { servicio: { select: { tipo: true } } },
  });

  let creadas = 0;
  let omitidas = 0;

  for (const asignacion of asignaciones) {
    const tipo = asignacion.servicio.tipo;

    if (tipo === "UNICO") {
      const existente = await prisma.visita.findFirst({
        where: { clienteServicioId: asignacion.id },
      });
      if (existente) {
        omitidas++;
        continue;
      }
      await prisma.visita.create({
        data: {
          clienteServicioId: asignacion.id,
          fechaProgramada: inicioMes,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      creadas++;
    } else {
      const frecuencia = asignacion.frecuenciaMensual ?? 1;
      const intervalo = Math.floor(diasEnMes / frecuencia);

      for (let i = 0; i < frecuencia; i++) {
        const dia = Math.min(1 + i * intervalo, diasEnMes);
        const fecha = new Date(anio, mes - 1, dia, 8, 0, 0);

        const existente = await prisma.visita.findFirst({
          where: {
            clienteServicioId: asignacion.id,
            fechaProgramada: {
              gte: new Date(anio, mes - 1, dia, 0, 0, 0),
              lt: new Date(anio, mes - 1, dia + 1, 0, 0, 0),
            },
          },
        });

        if (existente) {
          omitidas++;
          continue;
        }

        await prisma.visita.create({
          data: {
            clienteServicioId: asignacion.id,
            fechaProgramada: fecha,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        creadas++;
      }
    }
  }

  return NextResponse.json({ creadas, omitidas });
}

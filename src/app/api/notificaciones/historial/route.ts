import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "STAFF"].includes(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const estado = searchParams.get("estado");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (tipo) where.tipo = tipo;
  if (estado) where.estado = estado;
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setDate(hastaDate.getDate() + 1);
      where.createdAt.lt = hastaDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.notificacionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        visita: {
          select: {
            id: true,
            fechaProgramada: true,
            clienteServicio: {
              select: {
                cliente: { select: { nombre: true, apellido: true } },
                servicio: { select: { nombre: true } },
              },
            },
          },
        },
      },
    }),
    prisma.notificacionLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

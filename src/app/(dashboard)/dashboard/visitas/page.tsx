import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { VisitasPageClient } from "@/components/visitas/visitas-page-client";

export default async function VisitasPage() {
  const user = await requireAuth();

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitasWhere: any = {
    fechaProgramada: {
      gte: new Date(anioActual, mesActual - 1, 1),
      lt: new Date(anioActual, mesActual, 1),
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const csWhere: any = { estado: "ACTIVO" };

  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    visitasWhere.clienteServicio = { cliente: { sectorId: { in: sectorIds } } };
    csWhere.cliente = { sectorId: { in: sectorIds } };
  } else if (user.role === "JARDINERO") {
    const jardinero = await prisma.jardinero.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (jardinero) {
      visitasWhere.grupo = { miembros: { some: { jardineroId: jardinero.id } } };
    }
  }

  const [visitas, clienteServicios, grupos] = await Promise.all([
    prisma.visita.findMany({
      where: visitasWhere,
      orderBy: { fechaProgramada: "asc" },
      include: {
        clienteServicio: {
          include: {
            cliente: { select: { id: true, nombre: true } },
            servicio: { select: { id: true, nombre: true, tipo: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    }),
    prisma.clienteServicio.findMany({
      where: csWhere,
      include: {
        cliente: { select: { nombre: true } },
        servicio: { select: { nombre: true, tipo: true } },
      },
      orderBy: { cliente: { nombre: "asc" } },
    }),
    prisma.grupoJardinero.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const serialized = visitas.map((v) => ({
    ...v,
    fechaProgramada: v.fechaProgramada.toISOString(),
    fechaRealizada: v.fechaRealizada?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <VisitasPageClient
        initialVisitas={serialized}
        clienteServicios={clienteServicios}
        grupos={grupos}
        mesInicial={mesActual}
        anioInicial={anioActual}
        userRole={user.role}
      />
    </div>
  );
}

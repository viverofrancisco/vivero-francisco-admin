import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { VisitasPageClient } from "@/components/visitas/visitas-page-client";

export default async function VisitasPage() {
  const user = await requireAuth();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Default range: current month
  const desde = new Date(year, month, 1);
  const hasta = new Date(year, month + 1, 0);

  const desdeStr = desde.toISOString().split("T")[0];
  const hastaStr = hasta.toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitasWhere: any = {
    fechaProgramada: { gte: desde, lte: hasta },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesWhere: any = { deletedAt: null };

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    visitasWhere.clienteServicio = { cliente: { sectorId: { in: sectorIds } } };
    clientesWhere.sectorId = { in: sectorIds };
  } else if (user.role === "PERSONAL") {
    const personal = await prisma.personal.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (personal) {
      visitasWhere.OR = [
        { grupo: { miembros: { some: { personalId: personal.id } } } },
        { personal: { some: { personalId: personal.id, removedAt: null } } },
      ];
    }
  }

  const [visitas, clientes, servicios] = await Promise.all([
    prisma.visita.findMany({
      where: { ...visitasWhere, deletedAt: null },
      orderBy: { fechaProgramada: "asc" },
      include: {
        clienteServicio: {
          include: {
            cliente: { select: { id: true, nombre: true, apellido: true } },
            servicio: { select: { id: true, nombre: true, tipo: true } },
          },
        },
        grupo: { select: { id: true, nombre: true } },
      },
    }),
    prisma.cliente.findMany({
      where: clientesWhere,
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.servicio.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const serialized = visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    notas: v.notas,
    clienteServicio: {
      cliente: v.clienteServicio.cliente,
      servicio: v.clienteServicio.servicio,
    },
    grupo: v.grupo,
  }));

  const clienteOptions = clientes.map((c) => ({
    id: c.id,
    nombre: `${c.nombre} ${c.apellido || ""}`.trim(),
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <VisitasPageClient
        initialVisitas={serialized}
        initialDesde={desdeStr}
        initialHasta={hastaStr}
        userRole={user.role}
        clientes={clienteOptions}
        servicios={servicios}
      />
    </div>
  );
}

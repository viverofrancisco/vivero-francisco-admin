import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { NuevaVisitaPage } from "@/components/visitas/nueva-visita-page";

export default async function NuevaVisitaRoute() {
  const user = await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesWhere: any = {};

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    clientesWhere.sectorId = { in: sectorIds };
  }

  const [clientes, grupos, personalList] = await Promise.all([
    prisma.cliente.findMany({
      where: { ...clientesWhere, deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        servicios: {
          where: { estado: "ACTIVO" },
          select: {
            id: true,
            servicio: { select: { id: true, nombre: true, tipo: true } },
          },
        },
      },
    }),
    prisma.grupo.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        miembros: {
          select: { personalId: true },
        },
      },
    }),
    prisma.personal.findMany({
      where: { deletedAt: null, estado: "ACTIVO" },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const clientesSerialized = clientes.map((c) => ({
    id: c.id,
    nombre: `${c.nombre} ${c.apellido || ""}`.trim(),
    servicios: c.servicios.map((s) => ({
      id: s.id,
      servicio: s.servicio,
    })),
  }));

  const gruposSerialized = grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    miembrosIds: g.miembros.map((m) => m.personalId),
  }));

  return (
    <NuevaVisitaPage
      clientes={clientesSerialized}
      grupos={gruposSerialized}
      personalList={personalList}
    />
  );
}

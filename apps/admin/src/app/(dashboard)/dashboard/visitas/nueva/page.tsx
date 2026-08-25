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

  const [clientes, catalogo, grupos, personalList] = await Promise.all([
    prisma.cliente.findMany({
      where: { ...clientesWhere, deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        empresa: true,
        // Lo que cubre una suscripción activa no lleva precio en la visita.
        suscripciones: {
          where: { estado: "ACTIVO" },
          select: {
            periodicidad: true,
            items: {
              select: {
                precio: true,
                visitasPorPeriodo: true,
                producto: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    }),
    // Catálogo completo: permite agendar un servicio que el cliente no tiene
    // suscrito, sin pasar antes por otra pantalla.
    prisma.producto.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true, ivaTasa: true },
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
    nombre: c.nombre,
    apellido: c.apellido,
    empresa: c.empresa,
    // Productos que ya cubre una suscripción activa: se marcan al elegirlos.
    // Lo incluido es informativo; agendar de más está permitido.
    cubiertos: c.suscripciones.flatMap((sus) =>
      sus.items.map((i) => ({
        productoId: i.producto.id,
        nombre: i.producto.nombre,
        precio: Number(i.precio),
        visitasPorPeriodo: i.visitasPorPeriodo,
        periodicidad: sus.periodicidad as string,
      }))
    ),
  }));

  const catalogoSerialized = catalogo.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    tipo: s.tipo,
    ivaTasa: s.ivaTasa != null ? Number(s.ivaTasa) : null,
  }));

  const gruposSerialized = grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    miembrosIds: g.miembros.map((m) => m.personalId),
  }));

  return (
    <NuevaVisitaPage
      clientes={clientesSerialized}
      catalogo={catalogoSerialized}
      grupos={gruposSerialized}
      personalList={personalList}
    />
  );
}

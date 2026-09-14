import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { NuevaVisitaPage } from "@/components/visitas/nueva-visita-page";

export default async function NuevaVisitaRoute({
  searchParams,
}: {
  searchParams: Promise<{ suscripcion?: string }>;
}) {
  await requireAuth();
  // Llegar desde una suscripción deja el plan puesto: "nueva visita de este
  // plan" es una sola acción, no elegir cliente y plan de nuevo.
  const { suscripcion } = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesWhere: any = {};


  const [clientes, tareas, grupos, personalList] = await Promise.all([
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
            id: true,
            numero: true,
            periodicidad: true,
            items: {
              select: {
                visitasPorPeriodo: true,
                producto: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    }),
    // El catálogo de tareas, para poder exigir alguna. Va completo: exigir una
    // tarea no depende de qué tenga contratado el cliente.
    prisma.tarea.findMany({
      where: { deletedAt: null },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true },
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
    // Sus planes activos, para elegir de cuál es la visita. Lo que cada plan
    // cubre se deduce de sus productos: no es una decisión por producto.
    suscripciones: c.suscripciones.map((sus) => ({
      id: sus.id,
      numero: sus.numero,
      periodicidad: sus.periodicidad as string,
      productos: sus.items.map((i) => ({
        productoId: i.producto.id,
        nombre: i.producto.nombre,
        visitasPorPeriodo: i.visitasPorPeriodo,
      })),
    })),
  }));

  const gruposSerialized = grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    miembrosIds: g.miembros.map((m) => m.personalId),
  }));

  return (
    <NuevaVisitaPage
      suscripcionInicial={suscripcion}
      clientes={clientesSerialized}
      tareas={tareas}
      grupos={gruposSerialized}
      personalList={personalList}
    />
  );
}

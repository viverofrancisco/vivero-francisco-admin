import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { EditarVisitaPage } from "@/components/visitas/editar-visita-page";

export default async function EditarVisitaRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  // PERSONAL es solo lectura: no debería llegar ni por URL escrita a mano.
  if (user.role === "PERSONAL") notFound();

  const [visita, catalogo, grupos, personalList] = await Promise.all([
    prisma.visita.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fechaProgramada: true,
        fechaRealizada: true,
        horaEntrada: true,
        horaSalida: true,
        estado: true,
        notas: true,
        grupoId: true,
        suscripcionId: true,
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            empresa: true,
            sector: { select: { nombre: true } },
          },
        },
        productos: {
          orderBy: { posicion: "asc" },
          select: { productoId: true, suscripcionItemId: true },
        },
        personal: { where: { removedAt: null }, select: { personalId: true } },
      },
    }),
    prisma.producto.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.grupo.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true, miembros: { select: { personalId: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.personal.findMany({
      where: { deletedAt: null, estado: "ACTIVO" },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!visita) notFound();

  // Sus planes activos, más el que la visita ya tenga aunque esté pausado:
  // si no, editar una visita vieja la desvincularía sin querer.
  const planes = await prisma.suscripcion.findMany({
    where: {
      clienteId: visita.cliente.id,
      OR: [{ estado: "ACTIVO" }, { id: visita.suscripcionId ?? "" }],
    },
    select: {
      id: true,
      numero: true,
      estado: true,
      periodicidad: true,
      items: {
        select: {
          visitasPorPeriodo: true,
          producto: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: { numero: "asc" },
  });

  return (
    <EditarVisitaPage
      visita={{
        id: visita.id,
        fechaProgramada: visita.fechaProgramada.toISOString().split("T")[0],
        fechaRealizada:
          visita.fechaRealizada?.toISOString().split("T")[0] ?? null,
        horaEntrada: visita.horaEntrada,
        horaSalida: visita.horaSalida,
        estado: visita.estado,
        notas: visita.notas,
        cliente: visita.cliente,
        productos: visita.productos.map((p) => ({
          productoId: p.productoId,
        })),
        suscripcionId: visita.suscripcionId,
        grupoId: visita.grupoId,
        personalIds: visita.personal.map((p) => p.personalId),
      }}
      catalogo={catalogo}
      planes={planes.map((s) => ({
        id: s.id,
        numero: s.numero,
        estado: s.estado,
        periodicidad: s.periodicidad as string,
        productos: s.items.map((i) => ({
          productoId: i.producto.id,
          nombre: i.producto.nombre,
          visitasPorPeriodo: i.visitasPorPeriodo,
        })),
      }))}
      grupos={grupos.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        miembrosIds: g.miembros.map((m) => m.personalId),
      }))}
      personalList={personalList}
    />
  );
}

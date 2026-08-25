import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { EditarVisitaPage } from "@/components/visitas/editar-visita-page";
import { productosSuscritos } from "@/lib/services/suscripcion.service";

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
          orderBy: { orden: "asc" },
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

  // Qué del catálogo podría descontarse de un plan de ESTE cliente. Es lo que
  // decide si la fila muestra el interruptor de cobertura; el enlace concreto
  // lo resuelve el servidor al guardar.
  const cubribles = await productosSuscritos(visita.cliente.id);

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
          cubierto: p.suscripcionItemId !== null,
        })),
        cubribles,
        grupoId: visita.grupoId,
        personalIds: visita.personal.map((p) => p.personalId),
      }}
      catalogo={catalogo}
      grupos={grupos.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        miembrosIds: g.miembros.map((m) => m.personalId),
      }))}
      personalList={personalList}
    />
  );
}

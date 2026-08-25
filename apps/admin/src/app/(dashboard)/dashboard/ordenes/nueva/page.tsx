import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  getUserSectorIds,
  viewerFromUser,
} from "@/lib/auth-helpers";
import { listarPendientes } from "@/lib/services/orden.service";
import { productosSuscritos } from "@/lib/services/suscripcion.service";
import { NuevaOrdenPage } from "@/components/ordenes/nueva-orden-page";

export default async function NuevaOrdenRoute({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; visita?: string }>;
}) {
  const { cliente: clienteInicial, visita } = await searchParams;
  const user = await requireAuth();
  const viewer = viewerFromUser(user);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: null };
  if (user.role === "PERSONAL_ADMIN") {
    where.sectorId = { in: await getUserSectorIds(user.id) };
  }
  const [clientes, productos] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellido: true, empresa: true },
    }),
    prisma.producto.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        tipo: true,
        ivaTasa: true,
        contificoProductoId: true,
      },
    }),
  ]);

  // Con cliente en la URL se resuelven acá: la pantalla llega completa.
  const visible = clientes.some((c) => c.id === clienteInicial);

  // Viniendo de una visita, su trabajo entra ya cargado. La visita puede estar
  // agendada a futuro, así que el tope de fechas se estira hasta ella —solo
  // para las visitas: los períodos de suscripción siguen cortados en el mes.
  const laVisita = visita
    ? await prisma.visitaProducto.findMany({
        where: { visitaId: visita, visita: { clienteId: clienteInicial } },
        select: { id: true, visita: { select: { fechaProgramada: true } } },
      })
    : [];

  const finDeMes = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)
  );
  const hastaVisitas = laVisita.reduce(
    (tope, vp) =>
      vp.visita.fechaProgramada > tope ? vp.visita.fechaProgramada : tope,
    finDeMes
  );

  const [pendientes, suscritos] =
    clienteInicial && visible
      ? await Promise.all([
          listarPendientes(
            viewer,
            clienteInicial,
            new Date(Date.UTC(2000, 0, 1)),
            finDeMes,
            hastaVisitas
          ),
          productosSuscritos(clienteInicial),
        ])
      : [[], []];

  // Los ids no se toman de la URL a ciegas: se preselecciona solo lo que ya
  // salió de `listarPendientes`, que filtra por cliente y por viewer.
  const pendienteIds = new Set(
    pendientes.flatMap((p) => (p.tipo === "visita" ? [p.visitaProductoId] : []))
  );
  const preseleccion = laVisita
    .map((vp) => vp.id)
    .filter((id) => pendienteIds.has(id));

  return (
    <NuevaOrdenPage
      clientes={clientes}
      productos={productos.map((p) => ({
        ...p,
        ivaTasa: p.ivaTasa === null ? null : Number(p.ivaTasa),
      }))}
      clienteInicial={visible ? clienteInicial : undefined}
      suscritosIniciales={suscritos}
      preseleccion={preseleccion}
      desdeVisita={
        visita && laVisita.length > 0
          ? {
              id: visita,
              fecha: laVisita[0].visita.fechaProgramada.toISOString(),
            }
          : null
      }
      pendientesIniciales={pendientes.map((p) =>
        p.tipo === "visita"
          ? {
              tipo: "visita" as const,
              productoId: p.productoId,
              descripcion: p.descripcion,
              precio: String(p.precio),
              ivaTasa: String(p.ivaTasa),
              visitaProductoId: p.visitaProductoId,
              fecha: p.fecha.toISOString(),
            }
          : {
              tipo: "suscripcion" as const,
              productoId: p.productoId,
              descripcion: p.descripcion,
              precio: String(p.precio),
              ivaTasa: String(p.ivaTasa),
              suscripcionItemId: p.suscripcionItemId,
              periodoInicio: p.periodoInicio.toISOString(),
              periodoFin: p.periodoFin.toISOString(),
            }
      )}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { requireAuth, viewerFromUser, requireStaff } from "@/lib/auth-helpers";
import { listarPendientes } from "@/lib/services/orden.service";
import { productosVendibles } from "@/lib/services/variantes-vendibles";
import { NuevaOrdenPage } from "@/components/ordenes/nueva-orden-page";

export default async function NuevaOrdenRoute({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; visita?: string }>;
}) {
  await requireStaff();
  const { cliente: clienteInicial, visita } = await searchParams;
  const user = await requireAuth();
  const viewer = viewerFromUser(user);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: null };
  const [clientes, primeraTanda] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { nombre: "asc" },
      // Lo que la fila del teléfono muestra debajo del nombre —teléfono y
      // sector— y si está inactivo, que se ve atenuado y no se elige.
      select: {
        id: true,
        nombre: true,
        apellido: true,
        empresa: true,
        telefono: true,
        inactivoDesde: true,
        propiedades: {
          where: { deletedAt: null },
          take: 1,
          select: { sector: { select: { nombre: true } } },
        },
      },
    }),
    // La primera tanda: el resto llega al buscar o al bajar la lista.
    productosVendibles({ limit: 20 }),
  ]);

  // Con cliente en la URL se resuelven acá: la pantalla llega completa.
  const visible = clientes.some((c) => c.id === clienteInicial);

  // Viniendo de una visita, la orden queda marcada como suya. **No trae
  // líneas**: lo que se hizo en una visita son tareas, y una tarea no tiene
  // precio; los productos que se le cobran al cliente se eligen acá.
  const laVisita = visita
    ? await prisma.visita.findFirst({
        where: { id: visita, clienteId: clienteInicial, deletedAt: null },
        select: { id: true, numero: true, fechaProgramada: true },
      })
    : null;

  const finDeMes = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)
  );

  const pendientes =
    clienteInicial && visible
      ? await listarPendientes(
          viewer,
          clienteInicial,
          new Date(Date.UTC(2000, 0, 1)),
          finDeMes
        )
      : [];

  return (
    <NuevaOrdenPage
      clientes={clientes.map(({ propiedades, ...c }) => ({
        ...c,
        sector: propiedades[0]?.sector?.nombre ?? null,
      }))}
      productos={primeraTanda.items}
      hayMasProductos={primeraTanda.hayMas}
      clienteInicial={visible ? clienteInicial : undefined}
      desdeVisita={
        laVisita
          ? {
              id: laVisita.id,
              numero: laVisita.numero,
              fecha: laVisita.fechaProgramada.toISOString(),
            }
          : null
      }
      pendientesIniciales={pendientes.map((p) => ({
        tipo: "suscripcion" as const,
        suscripcionId: p.suscripcionId,
        suscripcionNumero: p.suscripcionNumero,
        propiedad: p.propiedad,
        descripcion: p.descripcion,
        precio: String(p.precio),
        ivaTasa: String(p.ivaTasa),
        periodoInicio: p.periodoInicio.toISOString(),
        periodoFin: p.periodoFin.toISOString(),
      }))}
    />
  );
}

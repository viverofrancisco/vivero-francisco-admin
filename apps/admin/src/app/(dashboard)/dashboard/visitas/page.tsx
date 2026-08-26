import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { VisitasPageClient } from "@/components/visitas/visitas-page-client";
import { PRODUCTOS_DE_VISITA_SELECT } from "@/lib/visita-productos";

/**
 * Los filtros de la lista viajan en la URL —para que volver desde una visita
 * devuelva la lista como estaba— así que los lee el servidor y no el cliente.
 * Si los leyera el cliente, esta pantalla mandaría siempre el mes actual sin
 * filtrar y habría que volver a pedir todo apenas monta.
 */
export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    estado?: string;
    cliente?: string;
    producto?: string;
  }>;
}) {
  const user = await requireAuth();
  const filtros = await searchParams;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Sin nada en la URL, el mes actual. Con `desde=` vacío no hay piso: es
  // "limpiar fechas", que no es lo mismo que no haber tocado nada.
  const desdeStr =
    filtros.desde !== undefined
      ? filtros.desde
      : new Date(year, month, 1).toISOString().split("T")[0];
  const hastaStr =
    filtros.hasta !== undefined
      ? filtros.hasta
      : new Date(year, month + 1, 0).toISOString().split("T")[0];

  const rango: { gte?: Date; lte?: Date } = {};
  if (desdeStr) rango.gte = new Date(`${desdeStr}T00:00:00.000Z`);
  if (hastaStr) rango.lte = new Date(`${hastaStr}T23:59:59.999Z`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitasWhere: any = {};
  if (rango.gte || rango.lte) visitasWhere.fechaProgramada = rango;
  if (filtros.estado && filtros.estado !== "ALL") {
    visitasWhere.estado = filtros.estado;
  }
  if (filtros.cliente && filtros.cliente !== "ALL") {
    visitasWhere.clienteId = filtros.cliente;
  }
  if (filtros.producto && filtros.producto !== "ALL") {
    visitasWhere.productos = { some: { productoId: filtros.producto } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesWhere: any = { deletedAt: null };

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    visitasWhere.cliente = {
      ...(visitasWhere.cliente ?? {}),
      sectorId: { in: sectorIds },
    };
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
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
        productos: PRODUCTOS_DE_VISITA_SELECT,
        grupo: { select: { id: true, nombre: true } },
      },
    }),
    prisma.cliente.findMany({
      where: clientesWhere,
      select: { id: true, nombre: true, apellido: true, empresa: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.producto.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const serialized = visitas.map((v) => ({
    id: v.id,
    numero: v.numero,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    notas: v.notas,
    cliente: v.cliente,
    productos: v.productos,
    grupo: v.grupo,
  }));

  const clienteOptions = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    empresa: c.empresa,
  }));

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <VisitasPageClient
        initialVisitas={serialized}
        initialDesde={desdeStr}
        initialHasta={hastaStr}
        filtros={{
          estado: filtros.estado,
          cliente: filtros.cliente,
          producto: filtros.producto,
        }}
        userRole={user.role}
        clientes={clienteOptions}
        productos={servicios}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import {
  esSoloNumero,
  filtroClientePorTexto,
  numeroBuscado,
} from "@/lib/services/busqueda";
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
    q?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    cliente?: string;
    producto?: string;
    completadaPor?: string;
    completadaDesde?: string;
    completadaHasta?: string;
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
  // Buscar por cliente escribiendo, en vez de encontrarlo en el desplegable.
  // Va contra la base y no sobre lo ya traído: la lista está acotada al mes,
  // y filtrar en el cliente buscaría solo dentro de ese mes.
  //
  // Palabra por palabra, no la frase entera contra cada campo: "Maria Luisa"
  // es el nombre completo de una y nombre + apellido de otra (ver
  // `filtroClientePorTexto`).
  //
  // Y el mismo campo entiende el número de la visita, con o sin `#`: "336" es
  // como se la nombra, y tener que acordarse de que ese buscador es solo de
  // clientes obliga a recorrer la lista a ojo. Van con OR porque un cliente
  // puede llamarse "Grupo 24" y esa búsqueda tiene que seguir encontrándolo.
  const numero = numeroBuscado(filtros.q);
  const cliente = esSoloNumero(filtros.q)
    ? null
    : filtroClientePorTexto(filtros.q);
  if (numero !== null) {
    visitasWhere.OR = [
      { numero },
      ...(cliente ? [{ cliente }] : []),
    ];
  } else if (cliente) {
    visitasWhere.cliente = cliente;
  }
  // Quién la cerró y cuándo. Van juntos porque responden la misma pregunta
  // —"¿qué cerró fulano la semana pasada?"— y las dos condiciones son sobre
  // el mismo par de columnas.
  if (filtros.completadaPor && filtros.completadaPor !== "ALL") {
    visitasWhere.completadaPorId = filtros.completadaPor;
  }
  if (filtros.completadaDesde || filtros.completadaHasta) {
    const cuando: { gte?: Date; lte?: Date } = {};
    if (filtros.completadaDesde) {
      cuando.gte = new Date(`${filtros.completadaDesde}T00:00:00.000Z`);
    }
    if (filtros.completadaHasta) {
      cuando.lte = new Date(`${filtros.completadaHasta}T23:59:59.999Z`);
    }
    visitasWhere.completadaEl = cuando;
  }

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    visitasWhere.cliente = {
      ...(visitasWhere.cliente ?? {}),
      sectorId: { in: sectorIds },
    };
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

  const [visitas, servicios, cerradores] = await Promise.all([
    prisma.visita.findMany({
      where: { ...visitasWhere, deletedAt: null },
      orderBy: { fechaProgramada: "asc" },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
        productos: PRODUCTOS_DE_VISITA_SELECT,
        grupo: { select: { id: true, nombre: true } },
      },
    }),
    prisma.producto.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    // Solo quienes de verdad cerraron alguna: un desplegable con todo el
    // personal obliga a adivinar cuál de esos nombres da resultados.
    prisma.user.findMany({
      where: { visitasCompletadas: { some: { deletedAt: null } } },
      select: { id: true, name: true, apellido: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = visitas.map((v) => ({
    id: v.id,
    numero: v.numero,
    fechaProgramada: v.fechaProgramada.toISOString().split("T")[0],
    fechaRealizada: v.fechaRealizada?.toISOString().split("T")[0] ?? null,
    estado: v.estado,
    completadaEl: v.completadaEl?.toISOString() ?? null,
    notas: v.notas,
    cliente: v.cliente,
    productos: v.productos,
    grupo: v.grupo,
  }));

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
      <VisitasPageClient
        initialVisitas={serialized}
        initialDesde={desdeStr}
        initialHasta={hastaStr}
        filtros={{
          q: filtros.q,
          estado: filtros.estado,
          cliente: filtros.cliente,
          producto: filtros.producto,
          completadaPor: filtros.completadaPor,
          completadaDesde: filtros.completadaDesde,
          completadaHasta: filtros.completadaHasta,
        }}
        cerradores={cerradores.map((u) => ({
          id: u.id,
          nombre: [u.name, u.apellido].filter(Boolean).join(" ") || "Sin nombre",
        }))}
        userRole={user.role}
        productos={servicios}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

export type SearchType = "cliente" | "visita" | "informe";

export interface SearchResultItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Optional status for visita rows (drives the StatusBadge). */
  estado?: string;
}

export interface SearchGroup {
  items: SearchResultItem[];
  total: number;
}

export interface GlobalSearchResult {
  clientes: SearchGroup;
  visitas: SearchGroup;
  informes: SearchGroup;
  total: number;
}

const EMPTY: SearchGroup = { items: [], total: 0 };

function fullName(nombre: string, apellido?: string | null): string {
  return `${nombre} ${apellido ?? ""}`.trim();
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function sectorIdsFor(viewer: Viewer): Promise<string[]> {
  const rows = await prisma.sectorAdmin.findMany({
    where: { userId: viewer.id },
    select: { sectorId: true },
  });
  return rows.map((r) => r.sectorId);
}

/**
 * Cross-entity search over clientes, visitas and informes, scoped to what the
 * viewer is allowed to see (ADMIN/STAFF: everything; PERSONAL_ADMIN: their
 * sectors; PERSONAL: only their own visitas).
 */
export async function globalSearch(
  viewer: Viewer,
  q: string,
  perType = 5
): Promise<GlobalSearchResult> {
  const term = q.trim();
  if (term.length < 2) {
    return { clientes: EMPTY, visitas: EMPTY, informes: EMPTY, total: 0 };
  }
  const take = Math.min(Math.max(perType, 1), 50);

  const staff = isAdminRole(viewer.role); // ADMIN | STAFF
  const personalAdmin = viewer.role === "PERSONAL_ADMIN";
  const personal = viewer.role === "PERSONAL";
  const sectorIds = personalAdmin ? await sectorIdsFor(viewer) : [];

  const insensitive = { mode: "insensitive" as const };
  // Multi-word terms (e.g. "Jorge Francisco") must match across nombre +
  // apellido: every token has to hit one of them. Single tokens just match
  // either field.
  const tokens = term.split(/\s+/).filter(Boolean);
  const clienteNameMatch = (): Prisma.ClienteWhereInput => ({
    AND: tokens.map((tok) => ({
      OR: [
        { nombre: { contains: tok, ...insensitive } },
        { apellido: { contains: tok, ...insensitive } },
      ],
    })),
  });

  // ── Clientes (staff + sector-scoped personal_admin) ──
  let clienteWhere: Prisma.ClienteWhereInput | null = null;
  if (staff || personalAdmin) {
    clienteWhere = {
      deletedAt: null,
      ...(personalAdmin ? { sectorId: { in: sectorIds } } : {}),
      OR: [clienteNameMatch(), { telefono: { contains: term } }],
    };
  }

  // ── Visitas (all roles; scoped) ──
  const visitaWhere: Prisma.VisitaWhereInput = {
    deletedAt: null,
    OR: [
      { clienteServicio: { cliente: clienteNameMatch() } },
      {
        clienteServicio: {
          servicio: { nombre: { contains: term, ...insensitive } },
        },
      },
    ],
  };
  if (personalAdmin) {
    visitaWhere.clienteServicio = { cliente: { sectorId: { in: sectorIds } } };
  }
  if (personal && viewer.personalId) {
    visitaWhere.AND = [
      {
        OR: [
          { grupo: { miembros: { some: { personalId: viewer.personalId } } } },
          {
            personal: {
              some: { personalId: viewer.personalId, removedAt: null },
            },
          },
        ],
      },
    ];
  }

  // ── Informes (staff + sector-scoped personal_admin) ──
  let informeWhere: Prisma.InformeWhereInput | null = null;
  if (staff || personalAdmin) {
    informeWhere = {
      ...(personalAdmin ? { cliente: { sectorId: { in: sectorIds } } } : {}),
      OR: [
        { titulo: { contains: term, ...insensitive } },
        { cliente: clienteNameMatch() },
      ],
    };
  }

  const [
    clientes,
    clientesTotal,
    visitas,
    visitasTotal,
    informes,
    informesTotal,
  ] = await Promise.all([
    clienteWhere
      ? prisma.cliente.findMany({
          where: clienteWhere,
          select: {
            id: true,
            nombre: true,
            apellido: true,
            ciudad: true,
            sector: { select: { nombre: true } },
          },
          orderBy: { nombre: "asc" },
          take,
        })
      : Promise.resolve([]),
    clienteWhere
      ? prisma.cliente.count({ where: clienteWhere })
      : Promise.resolve(0),
    prisma.visita.findMany({
      where: visitaWhere,
      select: {
        id: true,
        estado: true,
        fechaProgramada: true,
        clienteServicio: {
          select: {
            cliente: { select: { nombre: true, apellido: true } },
            servicio: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaProgramada: "desc" },
      take,
    }),
    prisma.visita.count({ where: visitaWhere }),
    informeWhere
      ? prisma.informe.findMany({
          where: informeWhere,
          select: {
            id: true,
            titulo: true,
            generatedAt: true,
            cliente: { select: { nombre: true, apellido: true } },
          },
          orderBy: { generatedAt: "desc" },
          take,
        })
      : Promise.resolve([]),
    informeWhere
      ? prisma.informe.count({ where: informeWhere })
      : Promise.resolve(0),
  ]);

  const clientesGroup: SearchGroup = {
    total: clientesTotal,
    items: clientes.map((c) => ({
      type: "cliente",
      id: c.id,
      title: fullName(c.nombre, c.apellido),
      subtitle: c.sector?.nombre ?? c.ciudad ?? "Cliente",
      href: `/dashboard/clientes/${c.id}`,
    })),
  };

  const visitasGroup: SearchGroup = {
    total: visitasTotal,
    items: visitas.map((v) => ({
      type: "visita",
      id: v.id,
      title: v.clienteServicio.servicio.nombre,
      subtitle: `${fullName(
        v.clienteServicio.cliente.nombre,
        v.clienteServicio.cliente.apellido
      )} · ${fmtDate(v.fechaProgramada)}`,
      href: `/dashboard/visitas/${v.id}`,
      estado: v.estado,
    })),
  };

  const informesGroup: SearchGroup = {
    total: informesTotal,
    items: informes.map((r) => ({
      type: "informe",
      id: r.id,
      title: r.titulo,
      subtitle: `${fullName(
        r.cliente.nombre,
        r.cliente.apellido
      )} · ${fmtDate(r.generatedAt)}`,
      href: `/dashboard/informes/${r.id}`,
    })),
  };

  return {
    clientes: clientesGroup,
    visitas: visitasGroup,
    informes: informesGroup,
    total: clientesTotal + visitasTotal + informesTotal,
  };
}

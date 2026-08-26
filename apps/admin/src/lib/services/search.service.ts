import { prisma } from "@/lib/prisma";
import { listaProductos } from "@/lib/visita-productos";
import { nombreCliente } from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";

export type SearchType =
  | "cliente"
  | "visita"
  | "orden"
  | "suscripcion"
  | "informe";

export interface SearchResultItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /**
   * Segunda línea, con el mismo peso que `subtitle`. En una visita van ahí los
   * productos: el título es el número, que es lo que se buscó y lo que se dice
   * en voz alta, y una lista de servicios adentro del título lo tapaba.
   */
  detalle?: string;
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
  ordenes: SearchGroup;
  suscripciones: SearchGroup;
  informes: SearchGroup;
  total: number;
}

const EMPTY: SearchGroup = { items: [], total: 0 };

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
 * Cross-entity search over clientes, visitas, órdenes, suscripciones and
 * informes, scoped to what the viewer is allowed to see (ADMIN/STAFF:
 * everything; PERSONAL_ADMIN: their sectors; PERSONAL: only their own visitas,
 * and no money at all).
 *
 * Números: cada tabla tiene su propia secuencia, así que "12" puede ser una
 * visita, una orden y una suscripción a la vez y se devuelven las tres.
 */
export async function globalSearch(
  viewer: Viewer,
  q: string,
  perType = 5
): Promise<GlobalSearchResult> {
  const term = q.trim();
  /**
   * Un número suelto —con o sin `#`— es lo que la gente dice en voz alta:
   * "la visita 137", "la orden 295". Cada tabla tiene su propia secuencia, así
   * que el mismo número puede ser las tres cosas y se muestran todas.
   */
  const numero = /^#?\d{1,9}$/.test(term)
    ? Number(term.replace("#", ""))
    : null;
  /**
   * Un dígito suelto es un número y nada más.
   *
   * Buscar "1" como texto engancha cualquier teléfono y cualquier producto que
   * lleve un uno: cincuenta filas de ruido tapando la visita #1, que es lo
   * único que alguien puede haber querido al escribir un solo carácter.
   */
  const soloNumero = numero !== null && term.replace("#", "").length < 2;

  // Con un número alcanza un dígito; para texto siguen haciendo falta dos.
  if (term.length < 2 && numero === null) {
    return {
      clientes: EMPTY,
      visitas: EMPTY,
      ordenes: EMPTY,
      suscripciones: EMPTY,
      informes: EMPTY,
      total: 0,
    };
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
    // Coincide por nombre+apellido (cada token en uno de los dos) o por empresa
    // (clientes que solo tienen empresa, sin nombre de persona).
    OR: [
      {
        AND: tokens.map((tok) => ({
          OR: [
            { nombre: { contains: tok, ...insensitive } },
            { apellido: { contains: tok, ...insensitive } },
          ],
        })),
      },
      { empresa: { contains: term, ...insensitive } },
    ],
  });

  // ── Clientes (staff + sector-scoped personal_admin) ──
  let clienteWhere: Prisma.ClienteWhereInput | null = null;
  if ((staff || personalAdmin) && !soloNumero) {
    clienteWhere = {
      deletedAt: null,
      ...(personalAdmin ? { sectorId: { in: sectorIds } } : {}),
      OR: [clienteNameMatch(), { telefono: { contains: term } }],
    };
  }

  // ── Visitas (all roles; scoped) ──
  const visitaWhere: Prisma.VisitaWhereInput = {
    deletedAt: null,
    OR: soloNumero
      ? [{ numero: numero! }]
      : [
          ...(numero !== null ? [{ numero }] : []),
          { cliente: clienteNameMatch() },
          {
            productos: {
              some: {
                producto: { nombre: { contains: term, ...insensitive } },
              },
            },
          },
        ],
  };
  if (personalAdmin) {
    visitaWhere.cliente = { sectorId: { in: sectorIds } };
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

  /**
   * Órdenes y suscripciones, **solo por número**.
   *
   * Por nombre de cliente no: quien busca "Manuel" quiere el cliente o sus
   * visitas, y devolverle además sus doce órdenes tapa lo que sí pidió. Su
   * ficha ya las lista. `PERSONAL` no las ve, como el resto de la plata.
   */
  const porNumero = numero !== null && (staff || personalAdmin);
  const ordenWhere: Prisma.OrdenWhereInput | null = porNumero
    ? {
        numero,
        ...(personalAdmin ? { cliente: { sectorId: { in: sectorIds } } } : {}),
      }
    : null;
  const suscripcionWhere: Prisma.SuscripcionWhereInput | null = porNumero
    ? {
        numero,
        ...(personalAdmin ? { cliente: { sectorId: { in: sectorIds } } } : {}),
      }
    : null;

  // ── Informes (staff + sector-scoped personal_admin) ──
  let informeWhere: Prisma.InformeWhereInput | null = null;
  if ((staff || personalAdmin) && !soloNumero) {
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
    ordenes,
    suscripciones,
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
            empresa: true,
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
        numero: true,
        estado: true,
        fechaProgramada: true,
        cliente: { select: { nombre: true, apellido: true, empresa: true } },
        productos: {
          orderBy: { posicion: "asc" },
          select: { producto: { select: { nombre: true } } },
        },
      },
      orderBy: { fechaProgramada: "desc" },
      take,
    }),
    prisma.visita.count({ where: visitaWhere }),
    // Sin `count`: el número es único por tabla, así que hay una o ninguna.
    ordenWhere
      ? prisma.orden.findMany({
          where: ordenWhere,
          select: {
            id: true,
            numero: true,
            estado: true,
            fecha: true,
            total: true,
            cliente: { select: { nombre: true, apellido: true, empresa: true } },
          },
          take,
        })
      : Promise.resolve([]),
    suscripcionWhere
      ? prisma.suscripcion.findMany({
          where: suscripcionWhere,
          select: {
            id: true,
            numero: true,
            estado: true,
            periodicidad: true,
            cliente: { select: { nombre: true, apellido: true, empresa: true } },
          },
          take,
        })
      : Promise.resolve([]),
    informeWhere
      ? prisma.informe.findMany({
          where: informeWhere,
          select: {
            id: true,
            titulo: true,
            generatedAt: true,
            cliente: { select: { nombre: true, apellido: true, empresa: true } },
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
      title: nombreCliente(c),
      subtitle: c.sector?.nombre ?? c.ciudad ?? "Cliente",
      href: `/dashboard/clientes/${c.id}`,
    })),
  };

  const visitasGroup: SearchGroup = {
    total: visitasTotal,
    items: visitas.map((v) => ({
      type: "visita",
      id: v.id,
      // El número solo: es lo que se dice en voz alta y lo que se buscó.
      title: `Visita #${v.numero}`,
      subtitle: `${nombreCliente(v.cliente)} · ${fmtDate(v.fechaProgramada)}`,
      detalle: listaProductos(v),
      href: `/dashboard/visitas/${v.id}`,
      estado: v.estado,
    })),
  };

  const ordenesGroup: SearchGroup = {
    total: ordenes.length,
    items: ordenes.map((o) => ({
      type: "orden",
      id: o.id,
      title: `Orden #${o.numero}`,
      subtitle: `${nombreCliente(o.cliente)} · ${fmtDate(o.fecha)} · ${
        o.estado.charAt(0) + o.estado.slice(1).toLowerCase()
      }`,
      href: `/dashboard/ordenes/${o.id}`,
    })),
  };

  const suscripcionesGroup: SearchGroup = {
    total: suscripciones.length,
    items: suscripciones.map((s) => ({
      type: "suscripcion",
      id: s.id,
      title: `Suscripción #${s.numero}`,
      subtitle: `${nombreCliente(s.cliente)} · ${
        s.periodicidad.charAt(0) + s.periodicidad.slice(1).toLowerCase()
      } · ${s.estado.charAt(0) + s.estado.slice(1).toLowerCase()}`,
      href: `/dashboard/suscripciones/${s.id}`,
    })),
  };

  const informesGroup: SearchGroup = {
    total: informesTotal,
    items: informes.map((r) => ({
      type: "informe",
      id: r.id,
      title: r.titulo,
      subtitle: `${nombreCliente(
        r.cliente
      )} · ${fmtDate(r.generatedAt)}`,
      href: `/dashboard/informes/${r.id}`,
    })),
  };

  return {
    clientes: clientesGroup,
    visitas: visitasGroup,
    ordenes: ordenesGroup,
    suscripciones: suscripcionesGroup,
    informes: informesGroup,
    total:
      clientesTotal +
      visitasTotal +
      ordenesGroup.total +
      suscripcionesGroup.total +
      informesTotal,
  };
}

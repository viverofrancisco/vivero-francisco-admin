import { prisma } from "@/lib/prisma";
import { listaTareas } from "@/lib/visita-tareas";
import { nombreCliente } from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { filtroClientePorTexto } from "./busqueda";

export type SearchType =
  | "cliente"
  | "visita"
  | "orden"
  | "suscripcion"
  | "informe"
  | "producto"
  | "solicitud";

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
  productos: SearchGroup;
  solicitudes: SearchGroup;
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

/**
 * Cross-entity search over clientes, visitas, órdenes, suscripciones,
 * informes and productos, scoped to what the viewer is allowed to see (ADMIN/STAFF:
 * everything; PERSONAL: only the visitas they are assigned to, and no money at
 * all).
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
      productos: EMPTY,
      solicitudes: EMPTY,
      total: 0,
    };
  }
  const take = Math.min(Math.max(perType, 1), 50);

  const staff = isAdminRole(viewer.role); // ADMIN | STAFF
  const personal = viewer.role === "PERSONAL";

  const insensitive = { mode: "insensitive" as const };
  // Una sola regla para todos los buscadores de clientes: cada palabra en
  // alguno de los campos. Vivía acá y las listas tenían su propia versión, que
  // era la que no encontraba "nombre apellido" (ver `filtroClientePorTexto`).
  const clienteNameMatch = (): Prisma.ClienteWhereInput =>
    filtroClientePorTexto(term) ?? {};

  // ── Clientes: solo la oficina ──
  let clienteWhere: Prisma.ClienteWhereInput | null = null;
  if (staff && !soloNumero) {
    clienteWhere = {
      deletedAt: null,
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
          // Por lo que se hizo: la tarea que alguien cargó en esa visita.
          {
            personal: {
              some: {
                removedAt: null,
                tareas: {
                  some: {
                    tarea: { nombre: { contains: term, ...insensitive } },
                  },
                },
              },
            },
          },
        ],
  };
  // El jardinero busca dentro de las visitas donde estuvo asignado, que son
  // las únicas que puede abrir.
  if (personal) {
    visitaWhere.personal = viewer.personalId
      ? { some: { personalId: viewer.personalId, removedAt: null } }
      : { some: { personalId: "ninguno" } };
  }

  /**
   * Órdenes y suscripciones, **solo por número**.
   *
   * Por nombre de cliente no: quien busca "Manuel" quiere el cliente o sus
   * visitas, y devolverle además sus doce órdenes tapa lo que sí pidió. Su
   * ficha ya las lista. `PERSONAL` no las ve, como el resto de la plata.
   */
  // Las órdenes y los planes son plata: solo la oficina. Encontrar algo que
  // después no se puede abrir es peor que no encontrarlo.
  const ordenWhere: Prisma.OrdenWhereInput | null =
    numero !== null && staff ? { numero } : null;
  const suscripcionWhere: Prisma.SuscripcionWhereInput | null =
    numero !== null && staff ? { numero } : null;

  // ── Informes: solo la oficina ──
  let informeWhere: Prisma.InformeWhereInput | null = null;
  if (staff) {
    informeWhere = soloNumero
      ? { numero: numero! }
      : {
          OR: [
            ...(numero !== null ? [{ numero }] : []),
            { titulo: { contains: term, ...insensitive } },
            { cliente: clienteNameMatch() },
          ],
        };
  }

  /**
   * Productos del catálogo, **solo la oficina** (su ficha es de la oficina,
   * como la de un cliente): cada palabra en el nombre o en el SKU de alguna de
   * sus variantes, así "jardinera fibra" y "fibra jardinera" dan lo mismo, y
   * el código que se lee en la etiqueta también lo encuentra. Archivados no.
   */
  const palabras = term.split(/\s+/).filter(Boolean);
  const productoWhere: Prisma.ProductoWhereInput | null =
    staff && !soloNumero
      ? {
          deletedAt: null,
          AND: palabras.map((w) => ({
            OR: [
              { nombre: { contains: w, ...insensitive } },
              { variantes: { some: { sku: { contains: w, ...insensitive } } } },
            ],
          })),
        }
      : null;

  /**
   * Solicitudes, **solo la oficina**: por su número, o con cada palabra en
   * quién la mandó (su ficha o lo que escribió el invitado), su teléfono, lo
   * que pide, los servicios que marcó o el lugar.
   */
  const solicitudWhere: Prisma.SolicitudClienteWhereInput | null = staff
    ? soloNumero
      ? { numero: numero! }
      : {
          OR: [
            ...(numero !== null ? [{ numero }] : []),
            {
              AND: palabras.map((w) => ({
                OR: [
                  { contactoNombre: { contains: w, ...insensitive } },
                  { contactoTelefono: { contains: w } },
                  { mensaje: { contains: w, ...insensitive } },
                  { direccion: { contains: w, ...insensitive } },
                  {
                    servicios: {
                      some: { producto: { nombre: { contains: w, ...insensitive } } },
                    },
                  },
                  { cliente: filtroClientePorTexto(w) ?? {} },
                  { cliente: { telefono: { contains: w } } },
                ],
              })),
            },
          ],
        }
    : null;

  const [
    clientes,
    clientesTotal,
    visitas,
    visitasTotal,
    ordenes,
    suscripciones,
    informes,
    informesTotal,
    productos,
    productosTotal,
    solicitudes,
    solicitudesTotal,
  ] = await Promise.all([
    clienteWhere
      ? prisma.cliente.findMany({
          where: clienteWhere,
          select: {
            id: true,
            nombre: true,
            apellido: true,
            empresa: true,
            // Dónde está: la primera de sus propiedades alcanza para
            // distinguir dos clientes que se llaman parecido.
            propiedades: {
              where: { deletedAt: null },
              select: { ciudad: true, sector: { select: { nombre: true } } },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
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
        tareasObligatorias: {
          select: { tarea: { select: { id: true, nombre: true, orden: true } } },
        },
        personal: {
          where: { removedAt: null },
          select: {
            personal: { select: { nombre: true, apellido: true } },
            tareas: {
              select: {
                tarea: { select: { id: true, nombre: true, orden: true } },
              },
            },
          },
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
            propiedad: { select: { nombre: true } },
          },
          take,
        })
      : Promise.resolve([]),
    informeWhere
      ? prisma.informe.findMany({
          where: informeWhere,
          select: {
            id: true,
            numero: true,
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
    productoWhere
      ? prisma.producto.findMany({
          where: productoWhere,
          select: {
            id: true,
            nombre: true,
            tipo: true,
            estado: true,
            _count: { select: { variantes: true } },
          },
          orderBy: { nombre: "asc" },
          take,
        })
      : Promise.resolve([]),
    productoWhere
      ? prisma.producto.count({ where: productoWhere })
      : Promise.resolve(0),
    solicitudWhere
      ? prisma.solicitudCliente.findMany({
          where: solicitudWhere,
          select: {
            id: true,
            numero: true,
            mensaje: true,
            createdAt: true,
            atendidaEl: true,
            contactoNombre: true,
            servicios: { select: { producto: { select: { nombre: true } } } },
            otroServicio: true,
            cliente: { select: { nombre: true, apellido: true, empresa: true } },
          },
          orderBy: { createdAt: "desc" },
          take,
        })
      : Promise.resolve([]),
    solicitudWhere
      ? prisma.solicitudCliente.count({ where: solicitudWhere })
      : Promise.resolve(0),
  ]);

  const clientesGroup: SearchGroup = {
    total: clientesTotal,
    items: clientes.map((c) => ({
      type: "cliente",
      id: c.id,
      title: nombreCliente(c),
      subtitle:
        c.propiedades[0]?.sector?.nombre ??
        c.propiedades[0]?.ciudad ??
        "Cliente",
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
      detalle: listaTareas(v),
      href: `/dashboard/visitas/${v.id}`,
      estado: v.estado,
    })),
  };

  const ordenesGroup: SearchGroup = {
    total: ordenes.length,
    items: ordenes.map((o) => ({
      type: "orden",
      id: o.id,
      title: `Pedido #${o.numero}`,
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
      subtitle: `${nombreCliente(s.cliente)} · ${s.propiedad.nombre} · ${
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
      title: `Informe #${r.numero}`,
      detalle: r.titulo,
      subtitle: `${nombreCliente(
        r.cliente
      )} · ${fmtDate(r.generatedAt)}`,
      href: `/dashboard/informes/${r.id}`,
    })),
  };

  const productosGroup: SearchGroup = {
    total: productosTotal,
    items: productos.map((p) => ({
      type: "producto",
      id: p.id,
      title: p.nombre,
      subtitle: [
        p.tipo === "SERVICIO" ? "Servicio" : "Producto",
        p._count.variantes > 1 ? `${p._count.variantes} variantes` : null,
        p.estado === "BORRADOR" ? "Borrador" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/dashboard/productos/${p.id}`,
    })),
  };

  const solicitudesGroup: SearchGroup = {
    total: solicitudesTotal,
    items: solicitudes.map((r) => ({
      type: "solicitud",
      id: r.id,
      title: `Solicitud #${r.numero}`,
      subtitle: [
        r.cliente ? nombreCliente(r.cliente) : (r.contactoNombre ?? "Sin nombre"),
        fmtDate(r.createdAt),
        r.atendidaEl ? "Atendida" : "Pendiente",
      ].join(" · "),
      detalle: [
        [...r.servicios.map((x) => x.producto.nombre), ...(r.otroServicio ? ["Otros"] : [])].join(", "),
        r.mensaje,
      ]
        .filter(Boolean)
        .join(" · "),
      // No tiene página propia: la lista la abre en su diálogo.
      href: `/dashboard/solicitudes?estado=todas&abrir=${r.id}`,
    })),
  };

  return {
    clientes: clientesGroup,
    visitas: visitasGroup,
    ordenes: ordenesGroup,
    suscripciones: suscripcionesGroup,
    informes: informesGroup,
    productos: productosGroup,
    solicitudes: solicitudesGroup,
    total:
      clientesTotal +
      visitasTotal +
      ordenesGroup.total +
      suscripcionesGroup.total +
      informesTotal +
      productosTotal +
      solicitudesTotal,
  };
}

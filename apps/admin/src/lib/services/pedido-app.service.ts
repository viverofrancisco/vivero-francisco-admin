import {
  direccionEnUnaLinea,
  nombreCliente,
  type PedidoBody,
  type PedidoInvitadoBody,
  type PedidoDelCliente,
} from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { normalizarCorreo } from "./correo-unico";
import {
  guardarDireccionComoPropiedad,
  type DireccionEscrita,
} from "./propiedad-desde-direccion";
import { hoyEnEcuador } from "@/lib/fechas";
import { sendNuevoPedidoEmail } from "@/lib/email";
import { pushNuevoPedido } from "@/lib/push/triggers";
import { baseUrl } from "./acceso.service";
import { armarLineas, centavos, type LineaOrdenInput } from "./orden.service";
import { bloquearVariantes, sincronizarReserva, StockInsuficienteError } from "./reserva.service";
import { ConflictError, NotFoundError, ValidationError } from "./errors";

/**
 * **El carrito del cliente se vuelve un pedido**: una `Orden` en `BORRADOR`
 * con `origen: APP`, que el vivero confirma, cobra y factura desde el portal
 * como cualquier otra. No hay pago en la app.
 *
 * - **Los precios los pone el servidor**, desde el catálogo (sin IVA en la
 *   línea, la tasa aparte, como toda línea de orden): la app solo dice qué
 *   variante y cuántas. Un precio que viene del teléfono es un precio que
 *   eligió el teléfono.
 * - **Solo bienes.** Los servicios salieron del catálogo de la app: se piden
 *   marcándolos en la solicitud de visita, porque una poda se cotiza y no se
 *   mete al carrito. Una app vieja que todavía los manda recibe un 400 que
 *   dice eso. Los pedidos viejos que los traen siguen leyéndose *por cotizar*.
 *   Un bien a $0 no se cotiza: es gratis.
 * - **El stock se aparta al pedir** (`reserva.service.ts`), en la misma
 *   transacción que crea el pedido: si no alcanza, no se crea nada y el
 *   cliente sabe qué falta.
 * - Al terminar se avisa al equipo: push y correo a administradores y staff.
 */

type Entrega = {
  entrega: "RETIRO" | "ENTREGA";
  retiroUbicacionId: string | null;
  entregaPropiedadId: string | null;
  entregaDireccion: string | null;
  entregaLat: number | null;
  entregaLng: number | null;
  /** La otra dirección, si pidió guardarla en su cuenta (se crea en la transacción). */
  guardar: DireccionEscrita | null;
};

async function entregaDelPedido(clienteId: string, e: PedidoBody["entrega"]): Promise<Entrega> {
  const vacia = {
    retiroUbicacionId: null,
    entregaPropiedadId: null,
    entregaDireccion: null,
    entregaLat: null,
    entregaLng: null,
  };
  if (e.tipo === "RETIRO") {
    // Una que el cliente puede elegir hoy: activa y con el retiro prendido.
    const u = await prisma.ubicacion.findFirst({
      where: { id: e.ubicacionId, activa: true, retiro: true },
      select: { id: true },
    });
    if (!u) throw new ConflictError("Ese lugar ya no recibe retiros. Elige otro lugar para retirar tu pedido.");
    return { ...vacia, guardar: null, entrega: "RETIRO", retiroUbicacionId: u.id };
  }
  if (e.tipo === "UBICACION") {
    return {
      ...vacia,
      guardar: e.guardar ? e : null,
      entrega: "ENTREGA",
      entregaDireccion: direccionEnUnaLinea(e),
      entregaLat: e.lat,
      entregaLng: e.lng,
    };
  }
  // Una propiedad **suya**: con el id de otra se le mandaría a la casa de otro.
  const p = await prisma.propiedad.findFirst({
    where: { id: e.propiedadId, clienteId, deletedAt: null },
    select: {
      id: true,
      direccion: true,
      numeroCasa: true,
      ciudad: true,
      referencia: true,
      lat: true,
      lng: true,
    },
  });
  if (!p) throw new ValidationError("Esa propiedad no es tuya.");
  // La dirección y el punto se copian: si después mueven el pin de la
  // propiedad, el pedido sigue diciendo adónde se pidió.
  return {
    ...vacia,
    guardar: null,
    entrega: "ENTREGA",
    entregaPropiedadId: p.id,
    entregaDireccion: direccionEnUnaLinea(p),
    entregaLat: p.lat,
    entregaLng: p.lng,
  };
}

export async function crearPedidoDesdeLaApp(
  autor: { userId: string; clienteId: string },
  body: PedidoBody,
  /** `avisar: false` para scripts y pruebas: sin push ni correo al equipo. */
  opciones: { avisar?: boolean } = {}
): Promise<{ id: string; numero: number }> {
  const cliente = await prisma.cliente.findFirst({
    where: { id: autor.clienteId, userId: autor.userId, deletedAt: null },
    select: { id: true, nombre: true, apellido: true, empresa: true },
  });
  if (!cliente) throw new NotFoundError("Tu cuenta no está vinculada a un cliente.");
  return crearPedido({ existente: cliente }, autor.userId, body, opciones);
}

/**
 * **El pedido de un invitado**, como el checkout de invitado de Shopify: el
 * mismo carrito, sin cuenta y con **cualquier correo**. Un pedido es de un
 * cliente —es lo que se confirma, se cobra y se factura—, así que:
 *
 * - si ese correo ya es de una ficha viva, el pedido **va a esa ficha**, sin
 *   tocarla (lo que escribió no pisa lo que el vivero cargó);
 * - si no, se le **crea la ficha** con su nombre, teléfono y correo, en la
 *   misma transacción que el pedido —si el stock no alcanza, no queda una
 *   ficha suelta—, y la dirección del envío pasa a ser su primera propiedad.
 *
 * En los dos casos el pedido guarda **con quién hablar**
 * (`contactoNombre`/`contactoTelefono`): quien pidió puede ser otro de la
 * casa, y es a él a quien se llama para confirmarlo. El costo, el mismo que
 * acepta Shopify: escribiendo el correo de otro se le deja un pedido en su
 * historial; queda en borrador, y nadie lo confirma sin hablar con el
 * teléfono que se dejó. Recibe en el vivero o en una dirección escrita, nunca
 * en una propiedad. Si después crea su cuenta con ese correo, ve el pedido.
 */
export async function crearPedidoDeInvitado(
  body: PedidoInvitadoBody,
  opciones: { avisar?: boolean } = {}
): Promise<{ id: string; numero: number }> {
  if (body.entrega.tipo === "PROPIEDAD") {
    throw new ValidationError("Sin cuenta no hay propiedades: elige retiro o escribe la dirección.");
  }
  const email = normalizarCorreo(body.contacto.email);
  const contacto = {
    nombre: body.contacto.nombre.trim(),
    telefono: body.contacto.telefono.trim(),
  };
  const fichas = email
    ? await prisma.cliente.findMany({
        where: { deletedAt: null, email: { equals: email, mode: "insensitive" } },
        select: { id: true, nombre: true, apellido: true, empresa: true },
        take: 2,
      })
    : [];
  // Una sola ficha con ese correo es ese cliente. (Dos no debería haber:
  // `Cliente_email_vivo_key`; si las hubiera, se crea otra y se fusionan.)
  const quien: QuienPide =
    fichas.length === 1
      ? { existente: fichas[0] }
      : { nuevo: { nombre: contacto.nombre, telefono: contacto.telefono, email: fichas.length ? null : email } };
  // La ficha de alguien que ya existe no se toca: ni su nombre y teléfono
  // (quién pidió queda en `contacto*` de la orden) ni sus propiedades. Un
  // invitado no ve *Guardar esta dirección*, pero la app la manda marcada, y
  // con el correo de otro su dirección se habría sumado a esa ficha.
  const entrega =
    body.entrega.tipo === "UBICACION" ? { ...body.entrega, guardar: false } : body.entrega;
  return crearPedido(quien, null, { ...body, entrega }, opciones, contacto);
}

type QuienPide =
  | { existente: { id: string; nombre: string; apellido: string | null; empresa: string | null } }
  | { nuevo: { nombre: string; telefono: string; email: string | null } };

async function crearPedido(
  quien: QuienPide,
  autorId: string | null,
  body: PedidoBody,
  { avisar = true }: { avisar?: boolean },
  /** Con quién hablar por este pedido, si lo hizo un invitado. */
  contacto: { nombre: string; telefono: string } | null = null
): Promise<{ id: string; numero: number }> {
  const existente = "existente" in quien ? quien.existente : null;
  const nombreDeQuienPide = existente ? nombreCliente(existente) : "nuevo" in quien ? quien.nuevo.nombre : "";

  // La misma variante dos veces es una sola línea.
  const cantidades = new Map<string, number>();
  for (const l of body.lineas) {
    cantidades.set(l.varianteId, (cantidades.get(l.varianteId) ?? 0) + l.cantidad);
  }

  const variantes = await prisma.variante.findMany({
    where: {
      id: { in: [...cantidades.keys()] },
      producto: { deletedAt: null, estado: "ACTIVO" },
    },
    select: {
      id: true,
      precio: true,
      cobraIva: true,
      valores: {
        select: { valor: { select: { valor: true, opcion: { select: { posicion: true } } } } },
      },
      producto: { select: { id: true, nombre: true, tipo: true, ivaTasa: true } },
    },
  });
  if (variantes.length !== cantidades.size) {
    throw new ValidationError(
      "Algo de tu carrito ya no está en el catálogo. Revísalo y vuelve a intentar."
    );
  }
  if (variantes.some((v) => v.producto.tipo === "SERVICIO")) {
    throw new ValidationError(
      "Los servicios se piden desde Solicitar una visita. Quítalos del carrito y vuelve a intentar."
    );
  }

  const porId = new Map(variantes.map((v) => [v.id, v]));
  const lineas: LineaOrdenInput[] = [...cantidades.entries()].map(([id, cantidad]) => {
    const v = porId.get(id)!;
    const combo = v.valores
      .map((x) => x.valor)
      .sort((a, b) => a.opcion.posicion - b.opcion.posicion)
      .map((x) => x.valor)
      .join(" / ");
    // Su precio de lista, que puede ser cero (gratis).
    const precio = Number(v.precio);
    return {
      descripcion: combo ? `${v.producto.nombre} · ${combo}` : v.producto.nombre,
      cantidad,
      precioUnitario: precio,
      ivaTasa: v.cobraIva && v.producto.ivaTasa !== null ? Number(v.producto.ivaTasa) : 0,
      productoId: v.producto.id,
      varianteId: v.id,
    };
  });

  const { guardar, ...entrega } = await entregaDelPedido(existente?.id ?? "", body.entrega);
  const armadas = armarLineas(lineas);

  const orden = await prisma.$transaction(async (tx) => {
    // **Lo primero, bloquear**: las variantes que se apartan y, si retira, la
    // ubicación. Dos clientes que piden la última unidad a la vez quedan en
    // fila —el segundo lee lo que dejó el primero— y una ubicación que el
    // administrador desactiva mientras alguien está en el checkout no recibe
    // ese pedido: la revisión de arriba se repite acá, con la fila trabada.
    await bloquearVariantes(tx, [...cantidades.keys()]);
    if (entrega.retiroUbicacionId) {
      const [u] = await tx.$queryRaw<{ nombre: string; activa: boolean; retiro: boolean }[]>`
        SELECT "nombre", "activa", "retiro" FROM "Ubicacion"
        WHERE "id" = ${entrega.retiroUbicacionId} FOR SHARE`;
      if (!u || !u.activa || !u.retiro) {
        throw new ConflictError(
          `${u?.nombre ?? "Ese lugar"} ya no recibe retiros. Elige otro lugar para retirar tu pedido.`
        );
      }
    }
    // El invitado nace acá, con su primera propiedad: la dirección a la que
    // pidió el envío, o la *Principal* vacía si retira en el vivero.
    let clienteId = existente?.id ?? "";
    if ("nuevo" in quien) {
      const e = body.entrega.tipo === "UBICACION" ? body.entrega : null;
      const creado = await tx.cliente.create({
        data: {
          nombre: quien.nuevo.nombre,
          telefono: quien.nuevo.telefono,
          email: quien.nuevo.email,
          propiedades: {
            create: {
              nombre: e ? e.direccion.trim().slice(0, 60) : "Principal",
              direccion: e?.direccion.trim() ?? null,
              numeroCasa: e?.numeroCasa?.trim() || null,
              ciudad: e?.ciudad?.trim() || null,
              referencia: e?.referencia?.trim() || null,
              lat: e?.lat ?? null,
              lng: e?.lng ?? null,
            },
          },
        },
        select: { id: true, propiedades: { select: { id: true } } },
      });
      clienteId = creado.id;
      if (e) entrega.entregaPropiedadId = creado.propiedades[0].id;
    } else if (guardar) {
      // Si pidió guardar la otra dirección, el pedido queda en esa propiedad.
      entrega.entregaPropiedadId = await guardarDireccionComoPropiedad(
        tx,
        clienteId,
        guardar,
        autorId
      );
    }
    const creada = await tx.orden.create({
      data: {
        clienteId,
        fecha: hoyEnEcuador(),
        estado: "BORRADOR",
        origen: "APP",
        stockReservado: true,
        ...entrega,
        contactoNombre: contacto?.nombre ?? null,
        contactoTelefono: contacto?.telefono ?? null,
        notas: body.notas?.trim() || null,
        subtotal: armadas.subtotal,
        iva: armadas.iva,
        total: centavos(armadas.subtotal.add(armadas.iva)),
        createdById: autorId,
        updatedById: autorId,
        lineas: { create: armadas.lineas },
      },
      select: { id: true, numero: true },
    });
    try {
      await sincronizarReserva(
        tx,
        creada.id,
        lineas,
        { id: autorId, nombre: nombreDeQuienPide },
        { validar: true }
      );
    } catch (e) {
      // Lo dicho para quien está comprando: qué se acabó y qué hacer.
      if (e instanceof StockInsuficienteError) {
        throw new ConflictError(
          `Mientras confirmabas, otra persona compró lo último de: ${e.faltan.join(", ")}. Ajusta tu carrito y vuelve a intentar.`
        );
      }
      throw e;
    }
    return creada;
  });

  // El aviso no frena al cliente: el pedido ya está hecho.
  if (avisar) void avisarAlEquipo(orden.id).catch((e) =>
    console.error("[pedido] no se pudo avisar al equipo:", e)
  );
  return orden;
}

/** Push y correo a administradores y staff, con lo pedido y cómo se entrega. */
async function avisarAlEquipo(ordenId: string): Promise<void> {
  const o = await prisma.orden.findUnique({
    where: { id: ordenId },
    select: {
      numero: true,
      total: true,
      entrega: true,
      retiroUbicacion: { select: { nombre: true } },
      entregaDireccion: true,
      notas: true,
      cliente: { select: { nombre: true, apellido: true, empresa: true, telefono: true } },
      contactoNombre: true,
      contactoTelefono: true,
      lineas: {
        orderBy: { posicion: "asc" },
        select: { descripcion: true, cantidad: true, total: true },
      },
    },
  });
  if (!o) return;

  // El de un invitado: quien escribió en el checkout, que es a quien se llama.
  const quien =
    o.contactoNombre && o.contactoNombre !== nombreCliente(o.cliente)
      ? `${o.contactoNombre} (${nombreCliente(o.cliente)})`
      : nombreCliente(o.cliente);
  const comoSeEntrega =
    o.entrega === "RETIRO" && o.retiroUbicacion
      ? `Retira en ${o.retiroUbicacion.nombre}`
      : `Entrega en ${o.entregaDireccion || "un punto del mapa"}`;

  await pushNuevoPedido(ordenId, { numero: o.numero, quien, lineas: o.lineas.length });

  const equipo = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] }, accesoRevocadoEl: null, email: { not: null } },
    select: { email: true },
  });
  const destinatarios = equipo.map((u) => u.email!).filter(Boolean);
  if (destinatarios.length === 0) return;

  await sendNuevoPedidoEmail(destinatarios, {
    numero: o.numero,
    cliente: quien,
    telefono: o.contactoTelefono ?? o.cliente.telefono,
    comoSeEntrega,
    notas: o.notas,
    lineas: o.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      total: Number(l.total),
    })),
    total: Number(o.total),
    enlace: `${baseUrl()}/dashboard/ordenes/${ordenId}`,
  });
}

const SELECT_PEDIDO = {
  id: true,
  numero: true,
  estado: true,
  createdAt: true,
  total: true,
  notas: true,
  entrega: true,
  retiroUbicacion: { select: { nombre: true } },
  entregaDireccion: true,
  entregaPropiedad: { select: { nombre: true } },
  lineas: {
    orderBy: { posicion: "asc" },
    select: {
      descripcion: true,
      cantidad: true,
      total: true,
      producto: { select: { tipo: true } },
    },
  },
} as const;

/** "Retiro en Vivero Aurora", "Entrega en Casa", "Entrega en Av. …": lo mismo en la app y en el portal. */
export function textoDeEntrega(o: {
  entrega: "RETIRO" | "ENTREGA" | null;
  retiroUbicacion: { nombre: string } | null;
  entregaDireccion: string | null;
  entregaPropiedad: { nombre: string } | null;
}): string {
  if (o.entrega === "RETIRO" && o.retiroUbicacion) {
    return `Retiro en ${o.retiroUbicacion.nombre}`;
  }
  if (o.entregaPropiedad) {
    return `Entrega en ${o.entregaPropiedad.nombre}${o.entregaDireccion ? ` (${o.entregaDireccion})` : ""}`;
  }
  return `Entrega en ${o.entregaDireccion ?? "la ubicación marcada"}`;
}

/**
 * El enlace a Google Maps del pedido: el punto de entrega o, si retira, el
 * pin de la ubicación. `null` si no hay punto que mostrar.
 */
export function mapaDelPedido(o: {
  entregaLat: number | null;
  entregaLng: number | null;
  retiroUbicacion: { lat: number | null; lng: number | null } | null;
}): string | null {
  const lat = o.entregaLat ?? o.retiroUbicacion?.lat ?? null;
  const lng = o.entregaLng ?? o.retiroUbicacion?.lng ?? null;
  return lat !== null && lng !== null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : null;
}

function aPedido(o: {
  id: string;
  numero: number;
  estado: "BORRADOR" | "CONFIRMADA" | "ANULADA";
  createdAt: Date;
  total: { toString(): string };
  notas: string | null;
  entrega: "RETIRO" | "ENTREGA" | null;
  retiroUbicacion: { nombre: string } | null;
  entregaDireccion: string | null;
  entregaPropiedad: { nombre: string } | null;
  lineas: {
    descripcion: string;
    cantidad: { toString(): string };
    total: { toString(): string };
    producto: { tipo: "SERVICIO" | "BIEN" } | null;
  }[];
}): PedidoDelCliente {
  const entrega = textoDeEntrega(o);
  const lineas = o.lineas.map((l) => {
    const total = Number(l.total);
    // Un servicio a $0 en un borrador es lo que está por cotizar; un bien a
    // $0 es gratis, y confirmado, un $0 es lo que el vivero decidió cobrar.
    return {
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      total:
        total === 0 && o.estado === "BORRADOR" && l.producto?.tipo === "SERVICIO" ? null : total,
    };
  });
  return {
    id: o.id,
    numero: o.numero,
    estado: o.estado,
    createdAt: o.createdAt.toISOString(),
    total: Number(o.total),
    porCotizar: lineas.some((l) => l.total === null),
    entrega,
    notas: o.notas,
    lineas,
  };
}

/** Los pedidos que el cliente hizo desde la app, el más nuevo primero. */
export async function listarPedidosDelCliente(clienteId: string): Promise<PedidoDelCliente[]> {
  const filas = await prisma.orden.findMany({
    where: { clienteId, origen: "APP" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: SELECT_PEDIDO,
  });
  return filas.map(aPedido);
}

/** Uno de sus pedidos: el de otro cliente no existe para él. */
export async function pedidoDelCliente(clienteId: string, id: string): Promise<PedidoDelCliente> {
  const o = await prisma.orden.findFirst({
    where: { id, clienteId, origen: "APP" },
    select: SELECT_PEDIDO,
  });
  if (!o) throw new NotFoundError("Pedido no encontrado");
  return aPedido(o);
}

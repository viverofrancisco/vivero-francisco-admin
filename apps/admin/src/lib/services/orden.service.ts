/**
 * Libro de ventas.
 *
 * Una orden es *lo que se vendió*, y existe desde que se hizo el trabajo —
 * antes de que exista factura. Toda la plata vive en `OrdenLinea`, venga de la
 * renovación de una suscripción o de una visita única. Eso hace que un reporte
 * de ventas sea una sola consulta, y que el historial completo viva en nuestra
 * propia base.
 *
 * Las órdenes se generan **a pedido**, no por cron: menos maquinaria, y no hay
 * un proceso que se caiga sin que nadie mire.
 */
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { propiedadesDeVisitas } from "@vivero/shared";
import {
  periodosDeSuscripcion,
  clavePeriodo,
  descripcionDePeriodoDePlan,
} from "@/lib/periodos";
import { hoyEnEcuador } from "@/lib/fechas";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { FACTURA_VIGENTE } from "./factura-vigente";
import { filtroClientePorTexto, numeroBuscado } from "./busqueda";

/**
 * Plata: solo ADMIN y STAFF.
 *
 * El corte no es "de quién es el cliente" sino "esto es dinero". El jardinero
 * ve sus visitas y registra lo que hizo en ellas; nada de lo que se cobra.
 */
function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

function ensureCanRead(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

/**
 * El cliente tiene que existir. Quién llega hasta acá ya pasó por
 * `ensureCanWrite`, que es de oficina, así que no hay alcance más fino que
 * aplicar: la oficina factura a cualquiera.
 */
async function ensureClienteVisible(viewer: Viewer, clienteId: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  return cliente;
}

const DEC = (n: Prisma.Decimal | number | null | undefined) =>
  new Prisma.Decimal(n ?? 0);

/** Redondeo a centavos, que es la precisión con la que se factura. */
function centavos(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2);
}

export interface LineaCalculada {
  descripcion: string;
  cantidad: Prisma.Decimal;
  precioUnitario: Prisma.Decimal;
  ivaTasa: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  iva: Prisma.Decimal;
  total: Prisma.Decimal;
}

/** Calcula los importes de una línea a partir de cantidad, precio y tasa. */
export function calcularLinea(
  descripcion: string,
  cantidad: Prisma.Decimal | number,
  precioUnitario: Prisma.Decimal | number,
  ivaTasa: Prisma.Decimal | number | null
): LineaCalculada {
  const cant = DEC(cantidad);
  const precio = DEC(precioUnitario);
  const tasa = DEC(ivaTasa);
  const subtotal = centavos(cant.mul(precio));
  const iva = centavos(subtotal.mul(tasa).div(100));
  return {
    descripcion,
    cantidad: cant,
    precioUnitario: precio,
    ivaTasa: tasa,
    subtotal,
    iva,
    total: centavos(subtotal.add(iva)),
  };
}

// ──────────────────────────────────────────────
// Qué está pendiente de facturar
// ──────────────────────────────────────────────

/**
 * Tope de fechas para las visitas cuando no hay ninguno: todas.
 *
 * Una visita agendada a futuro es facturable —cobrar por adelantado es normal—
 * así que cortarlas en el mes actual escondía justo las que alguien quiere
 * asignarle a una orden. Los períodos de suscripción **sí** siguen cortados:
 * cobrar un período que no arrancó es otra decisión.
 */

export interface PendienteSuscripcion {
  tipo: "suscripcion";
  /** El plan cuyo período es. */
  suscripcionId: string;
  /** Para nombrarlo en la lista: "Suscripción #12 · Casa". */
  suscripcionNumero: number;
  propiedad: string;
  /** Con lo que nace la línea: "Plan mensual · Casa · septiembre 2026". */
  descripcion: string;
  periodoInicio: Date;
  periodoFin: Date;
  precio: Prisma.Decimal;
  ivaTasa: Prisma.Decimal;
}

export type Pendiente = PendienteSuscripcion;

/**
 * Períodos de suscripción por facturar, entre dos fechas.
 *
 * **Las visitas ya no entran acá.** Salían cuando la visita llevaba productos:
 * cada producto suelto era un trabajo con precio por poner. Hoy una visita
 * lleva tareas, y una tarea no se cobra —no tiene precio ni se vende—, así que
 * no hay nada que "quede pendiente" de una visita. Cobrarle a alguien lo que se
 * le hizo es armar una orden con productos del catálogo y, si se quiere dejar
 * dicho por qué, marcar las visitas que cubre.
 *
 * Un período que ya tiene línea de orden no vuelve a aparecer, y eso lo
 * garantiza el índice único `[suscripcionId, periodoInicio]`, no solo este
 * filtro.
 */
export async function listarPendientes(
  viewer: Viewer,
  clienteId: string,
  desde: Date,
  hasta: Date,
  /**
   * Una orden que se está editando. Sus propios períodos cuentan como
   * disponibles: si no, al abrir el editor desaparecerían de la lista y no
   * habría forma de desmarcarlos.
   */
  ordenId?: string
): Promise<Pendiente[]> {
  ensureCanRead(viewer);

  const suscripciones = await prisma.suscripcion.findMany({
    where: { clienteId, estado: "ACTIVO" },
    include: PLAN_PARA_COBRAR_INCLUDE,
  });

  const pendientes: Pendiente[] = [];

  // Un período de cobro por cada uno que toque el rango.
  for (const sus of suscripciones) {
    const yaFacturados = new Set(
      sus.ordenLineas
        .filter((l) => l.ordenId !== ordenId)
        .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
        .filter(Boolean) as string[]
    );

    for (const periodo of periodosDeSuscripcion(
      sus.fechaInicio,
      sus.periodicidad,
      hasta
    )) {
      // Solo entran los períodos que se solapan con el rango pedido.
      if (periodo.fin < desde || periodo.inicio > hasta) continue;
      if (yaFacturados.has(clavePeriodo(periodo.inicio))) continue;
      pendientes.push({
        tipo: "suscripcion",
        suscripcionId: sus.id,
        suscripcionNumero: sus.numero,
        propiedad: sus.propiedad.nombre,
        descripcion: descripcionDelPeriodo(sus, periodo),
        periodoInicio: periodo.inicio,
        periodoFin: periodo.fin,
        precio: DEC(sus.precio),
        ivaTasa: DEC(sus.ivaTasa),
      });
    }
  }

  return pendientes;
}

/**
 * Lo que hace falta de un plan para cobrarle un período: sus términos, sus
 * períodos ya cobrados y cómo nombrar la línea. Lo comparten `listarPendientes`,
 * el resumen de períodos sin orden y las renovaciones automáticas, que son la
 * misma pregunta hecha en tres momentos.
 */
const PLAN_PARA_COBRAR_INCLUDE = {
  propiedad: { select: { nombre: true } },
  // Cuántas propiedades vivas tiene el cliente: con una sola, la línea no la
  // nombra ("Principal" no dice nada en una factura).
  cliente: {
    select: {
      _count: { select: { propiedades: { where: { deletedAt: null } } } },
    },
  },
  ordenLineas: { select: { periodoInicio: true, ordenId: true } },
} satisfies Prisma.SuscripcionInclude;

type PlanParaCobrar = Prisma.SuscripcionGetPayload<{
  include: typeof PLAN_PARA_COBRAR_INCLUDE;
}>;

function descripcionDelPeriodo(
  sus: PlanParaCobrar,
  periodo: { inicio: Date; fin: Date }
): string {
  return descripcionDePeriodoDePlan(sus, periodo, {
    nombrarPropiedad: sus.cliente._count.propiedades > 1,
  });
}

// ──────────────────────────────────────────────
// Crear la orden
// ──────────────────────────────────────────────

/**
 * Una línea tal como la arma quien crea la orden.
 *
 * `descripcion` y `precioUnitario` son la verdad: el catálogo solo prellena el
 * formulario. `productoId` y la procedencia (`suscripcionId` + período) son
 * para reportes y para que un período no se facture dos veces; nunca son la
 * fuente del precio.
 *
 * **Una línea es de un producto, de un período de un plan, o personalizada.**
 * La del plan no lleva producto: un plan es un precio por un jardín, y su
 * código impreso sale del número del plan. La personalizada tampoco: es un
 * trabajo puntual escrito a mano, con un código genérico impreso. Solo la de
 * producto lleva variante.
 */
export interface LineaOrdenInput {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
  productoId?: string | null;
  /**
   * Qué variante se vende. Todo producto tiene al menos una, y con una sola
   * el servicio la completa. Es lo que decide qué SKU se imprime y de qué
   * stock se descuenta al facturar. Sin producto, ninguna.
   */
  varianteId?: string | null;
  suscripcionId?: string | null;
  periodoInicio?: Date | null;
  periodoFin?: Date | null;
}

export interface CrearOrdenPayload {
  clienteId: string;
  fecha?: Date;
  notas?: string | null;
  /** Con qué facturar. Si no viene, al emitir se usa el predeterminado. */
  datoFacturacionId?: string | null;
  lineas: LineaOrdenInput[];
  /**
   * Qué visitas cubre esta orden. Opcional, y **solo traza**: sirve para ir de
   * la orden a la visita y al revés. Ninguna línea sale de acá — lo que se hace
   * en una visita son tareas, y una tarea no tiene precio.
   */
  visitaIds?: string[];
}

/**
 * Crea una orden en BORRADOR con las líneas que le pasen.
 *
 * Es el único escritor de órdenes: `generarOrden` (que arma las líneas desde
 * lo pendiente) termina acá. Las líneas con procedencia se validan contra el
 * cliente de la orden — si no, mandando un id a mano se podría facturar el
 * trabajo de otro cliente.
 */
export async function crearOrden(viewer: Viewer, payload: CrearOrdenPayload) {
  ensureCanWrite(viewer);
  await ensureClienteVisible(viewer, payload.clienteId);

  // Las mismas reglas que al editar: una sola función, para que no se separen.
  const visitaIds = [...new Set(payload.visitaIds ?? [])];
  await validarLineas(payload.clienteId, payload.lineas, visitaIds);
  await ensureDatoDelCliente(payload.clienteId, payload.datoFacturacionId);

  const { lineas, subtotal, iva } = armarLineas(payload.lineas);
  const origen = await origenDeLaOrden(payload.lineas, visitaIds);

  try {
    return await prisma.orden.create({
      data: {
        clienteId: payload.clienteId,
        suscripcionId: origen.suscripcionId,
        visitas: {
          create: origen.visitaIds.map((visitaId) => ({ visitaId })),
        },
        datoFacturacionId: payload.datoFacturacionId ?? null,
        fecha: payload.fecha ?? hoyEnEcuador(),
        estado: "BORRADOR",
        notas: payload.notas?.trim() || null,
        subtotal,
        iva,
        total: centavos(subtotal.add(iva)),
        createdById: viewer.id,
        updatedById: viewer.id,
        lineas: { create: lineas },
      },
      include: { lineas: { orderBy: { posicion: "asc" } } },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "Parte de ese trabajo ya está en otra orden. Vuelve a armarla."
      );
    }
    throw error;
  }
}

/**
 * Los datos de facturación tienen que ser del mismo cliente que la orden. Si no,
 * se le facturaría a alguien con la razón social de otro.
 */
async function ensureDatoDelCliente(
  clienteId: string,
  datoFacturacionId?: string | null
): Promise<void> {
  if (!datoFacturacionId) return;
  const dato = await prisma.datoFacturacion.findUnique({
    where: { id: datoFacturacionId },
    select: { clienteId: true },
  });
  if (!dato || dato.clienteId !== clienteId) {
    throw new ValidationError(
      "Esos datos de facturación no son de este cliente."
    );
  }
}

/** Calcula las líneas persistibles y los totales de la orden. */
function armarLineas(entrada: LineaOrdenInput[]) {
  const lineas = entrada.map((l, idx) => ({
    posicion: idx,
    ...calcularLinea(
      l.descripcion.trim(),
      l.cantidad,
      l.precioUnitario,
      l.ivaTasa
    ),
    productoId: l.productoId ?? null,
    // Con producto, `ensureVariantes` ya la completó; sin producto no hay.
    varianteId: l.varianteId ?? null,
    suscripcionId: l.suscripcionId ?? null,
    periodoInicio: l.periodoInicio ?? null,
    periodoFin: l.periodoFin ?? null,
  }));

  const subtotal = centavos(
    lineas.reduce((acc, l) => acc.add(l.subtotal), new Prisma.Decimal(0))
  );
  const iva = centavos(
    lineas.reduce((acc, l) => acc.add(l.iva), new Prisma.Decimal(0))
  );
  return { lineas, subtotal, iva };
}

/** Las mismas reglas que al crear: nada entra por la puerta de atrás. */
async function validarLineas(
  clienteId: string,
  lineas: LineaOrdenInput[],
  visitaIds: string[]
): Promise<void> {
  if (lineas.length === 0) {
    throw new ValidationError("La orden necesita al menos un producto.");
  }
  for (const l of lineas) {
    if (!l.descripcion.trim()) {
      throw new ValidationError("Cada producto necesita una descripción.");
    }
    if (!(l.cantidad > 0)) {
      throw new ValidationError(
        `La cantidad de "${l.descripcion}" tiene que ser mayor a 0.`
      );
    }
    if (!(l.precioUnitario >= 0)) {
      throw new ValidationError(
        `El precio de "${l.descripcion}" no puede ser negativo.`
      );
    }
    if (l.ivaTasa < 0 || l.ivaTasa > 100) {
      throw new ValidationError(
        `El IVA de "${l.descripcion}" tiene que estar entre 0 y 100.`
      );
    }
    if (l.suscripcionId && !l.periodoInicio) {
      throw new ValidationError(
        `"${l.descripcion}" viene de una suscripción y necesita período.`
      );
    }
    // Una línea es de un producto, de un período de plan, o **personalizada**:
    // sin producto ni plan, con lo que dice su descripción. El SRI pide un
    // `codigoPrincipal` por detalle, y la personalizada imprime uno genérico
    // (`codigoDeLineaPersonalizada`): lo que se vendió lo dice el texto, no el
    // catálogo. Es el "ítem personalizado" de Shopify — un trabajo puntual
    // que no vale la pena dar de alta como producto.
  }
  await ensureVariantes(lineas);
  ensureNoMezclaOrigenes(lineas, visitaIds);
  await ensureProcedenciaDelCliente(clienteId, lineas, visitaIds);
}

/**
 * Toda línea con producto sale de una variante, y acá se completa si no vino.
 *
 * **Todo producto tiene al menos una.** Un servicio y un bien sin opciones
 * tienen exactamente una, así que preguntar cuál sería preguntar por una
 * decisión que no existe — y los borradores que arma el portal solo no tienen
 * a nadie a quien preguntarle.
 *
 * Con varias sí hace falta elegir: nadie puede adivinar cuál de las seis
 * macetas se vendió, y sin eso no se sabe qué SKU imprimir ni de dónde
 * descontar. Ahí corta, y quien arma la orden lo resuelve en pantalla.
 *
 * Después de esto, `varianteId` está en toda línea con producto, y nada más
 * abajo tiene que preguntarse el tipo. La línea de un plan no pasa por acá:
 * no tiene producto, así que no tiene variante.
 */
async function ensureVariantes(lineas: LineaOrdenInput[]): Promise<void> {
  const conProducto = lineas.filter(
    (l): l is LineaOrdenInput & { productoId: string } => !!l.productoId
  );
  if (conProducto.length === 0) return;
  const productos = await prisma.producto.findMany({
    where: { id: { in: [...new Set(conProducto.map((l) => l.productoId))] } },
    select: {
      id: true,
      nombre: true,
      variantes: { select: { id: true }, orderBy: { posicion: "asc" } },
    },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  for (const l of conProducto) {
    const producto = porId.get(l.productoId);
    if (!producto) {
      throw new ValidationError(`"${l.descripcion}" apunta a un producto que no existe.`);
    }
    if (!l.varianteId) {
      if (producto.variantes.length === 1) {
        l.varianteId = producto.variantes[0].id;
        continue;
      }
      throw new ValidationError(
        producto.variantes.length === 0
          ? `"${producto.nombre}" no tiene ninguna variante para vender.`
          : `Falta elegir qué variante de "${producto.nombre}" se vende.`
      );
    }
    if (!producto.variantes.some((v) => v.id === l.varianteId)) {
      throw new ValidationError(`Esa variante no es de "${producto.nombre}".`);
    }
  }
}

/*
 * Acá vivía `ensureTrabajoCompleto`: "un período de plan se factura entero",
 * o sea con todos los ítems del plan. Se fue con los ítems. Un período es hoy
 * **una** línea —el plan tiene un precio, no una lista— así que no hay mitad
 * que dejar afuera, y el índice único `[suscripcionId, periodoInicio]` es todo
 * lo que hace falta para que no se cobre dos veces.
 */

export interface ActualizarOrdenPayload {
  /**
   * Cambiar de cliente en un borrador. Todo lo que dependa del anterior —las
   * líneas con procedencia y los datos de facturación— se valida contra el
   * nuevo, así que si algo no le corresponde el cambio se rechaza entero.
   */
  clienteId?: string;
  fecha?: Date;
  notas?: string | null;
  datoFacturacionId?: string | null;
  /** Si viene, reemplaza el conjunto completo de líneas. */
  lineas?: LineaOrdenInput[];
  /** Si viene, reemplaza el conjunto completo de visitas cubiertas. */
  visitaIds?: string[];
}

/**
 * Edita una orden que todavía está en BORRADOR.
 *
 * Solo el borrador se toca: una vez confirmada, la orden es lo que se le va a
 * facturar al cliente, y una vez facturada el comprobante ya está firmado y en
 * el SRI. Mover el número hacia atrás sería mentirle al historial.
 */
export async function actualizarOrden(
  viewer: Viewer,
  id: string,
  payload: ActualizarOrdenPayload
) {
  ensureCanWrite(viewer);
  const actual = await getOrden(viewer, id);
  if (actual.estado !== "BORRADOR") {
    throw new ConflictError(
      `Esta orden está ${actual.estado.toLowerCase()}: solo se puede editar un borrador.`
    );
  }

  // Todo se valida contra el cliente que va a quedar, no contra el que había.
  const clienteId = payload.clienteId ?? actual.clienteId;
  if (payload.clienteId && payload.clienteId !== actual.clienteId) {
    await ensureClienteVisible(viewer, payload.clienteId);
    // Las líneas que no se reemplazan siguen apuntando al cliente viejo.
    if (!payload.lineas) {
      const conProcedencia = actual.lineas.filter((l) => l.suscripcionId);
      if (conProcedencia.length > 0) {
        throw new ValidationError(
          "Esta orden tiene productos que vienen del trabajo del cliente anterior. Quitalos antes de cambiar de cliente."
        );
      }
    }
  }
  // Las visitas que van a quedar: las que manden, o las que ya tenía.
  const visitaIds =
    payload.visitaIds !== undefined
      ? [...new Set(payload.visitaIds)]
      : actual.visitas.map((v) => v.visita.id);
  if (payload.lineas) {
    await validarLineas(clienteId, payload.lineas, visitaIds);
  }

  // Si lo mandan explícito, tiene que ser del cliente que queda: pasar uno
  // ajeno es un error y se avisa.
  if (payload.datoFacturacionId !== undefined) {
    await ensureDatoDelCliente(clienteId, payload.datoFacturacionId);
  }

  // Y si cambió el cliente sin tocar la facturación, la que había era del
  // anterior: se limpia. Dejarla sería emitirle al nuevo con la razón social
  // del viejo, que es el error más caro que puede cometer esta pantalla.
  let limpiarDato = false;
  if (
    payload.clienteId &&
    payload.clienteId !== actual.clienteId &&
    payload.datoFacturacionId === undefined &&
    actual.datoFacturacionId
  ) {
    limpiarDato = true;
  }

  // Fuera de la transacción: son lecturas y no hace falta sostenerla.
  // Se recalcula si cambió cualquiera de las dos puntas: las líneas mandan el
  // plan, las visitas se marcan.
  const origen =
    payload.lineas || payload.visitaIds !== undefined
      ? await origenDeLaOrden(
          payload.lineas ??
            actual.lineas.map((l) => ({
              ...l,
              cantidad: Number(l.cantidad),
              precioUnitario: Number(l.precioUnitario),
              ivaTasa: Number(l.ivaTasa),
            })),
          visitaIds
        )
      : null;

  try {
    return await prisma.$transaction(async (tx) => {
      let totales: { subtotal: Prisma.Decimal; iva: Prisma.Decimal } | null =
        null;

      if (payload.lineas) {
        const armadas = armarLineas(payload.lineas);
        totales = { subtotal: armadas.subtotal, iva: armadas.iva };
        // Se reemplaza el conjunto entero: las procedencias liberadas vuelven a
        // aparecer como pendientes, que es justo lo que se espera al sacar una
        // línea de un borrador.
        await tx.ordenLinea.deleteMany({ where: { ordenId: id } });
        // Una por una y no `createMany`: cada línea crea además sus filas de
        // `OrdenLineaOrigen`, y `createMany` no anida relaciones. Son cuatro o
        // cinco líneas por orden, no hay nada que optimizar.
        for (const l of armadas.lineas) {
          await tx.ordenLinea.create({ data: { ...l, ordenId: id } });
        }
      }

      if (origen) {
        await tx.ordenVisita.deleteMany({ where: { ordenId: id } });
        if (origen.visitaIds.length > 0) {
          await tx.ordenVisita.createMany({
            data: origen.visitaIds.map((visitaId) => ({ ordenId: id, visitaId })),
          });
        }
      }

      return tx.orden.update({
        where: { id },
        data: {
          ...(payload.clienteId ? { clienteId: payload.clienteId } : {}),
          ...(payload.fecha ? { fecha: payload.fecha } : {}),
          ...(payload.notas !== undefined
            ? { notas: payload.notas?.trim() || null }
            : {}),
          ...(payload.datoFacturacionId !== undefined
            ? { datoFacturacionId: payload.datoFacturacionId }
            : limpiarDato
              ? { datoFacturacionId: null }
              : {}),
          ...(totales
            ? {
                subtotal: totales.subtotal,
                iva: totales.iva,
                total: centavos(totales.subtotal.add(totales.iva)),
              }
            : {}),
          ...(origen ? { suscripcionId: origen.suscripcionId } : {}),
          updatedById: viewer.id,
        },
        include: { lineas: { orderBy: { posicion: "asc" } } },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "Parte de ese trabajo ya está en otra orden. Revisa los productos."
      );
    }
    throw error;
  }
}

/**
 * Una orden es de un plan **o** de unas visitas, nunca de las dos cosas.
 *
 * Se cobran en momentos distintos y responden a acuerdos distintos: el plan es
 * lo pactado y se renueva solo, el trabajo suelto es algo que pasó y se cotiza.
 * Juntarlos daba una orden cuyo total no se podía explicar sin abrirla, y el
 * cliente recibía una factura mezclando su mensualidad con trabajos puntuales.
 *
 * Lo que cambió es **cómo se sabe de qué es**: antes salía de la procedencia de
 * las líneas, porque cada línea decía de qué renglón de qué visita venía. Hoy
 * las visitas se marcan a mano —una tarea no tiene precio, así que no hay
 * línea que venga de una— y el plan se sigue deduciendo de las líneas, que
 * siguen llevando su `suscripcionId`.
 */
function ensureNoMezclaOrigenes(
  lineas: LineaOrdenInput[],
  visitaIds: string[]
): void {
  const conPeriodo = lineas.some((l) => l.suscripcionId);
  if (conPeriodo && visitaIds.length > 0) {
    throw new ValidationError(
      "Una orden no puede cubrir un período de suscripción y visitas a la vez. Armá una orden para el plan y otra para las visitas."
    );
  }
}

/**
 * De qué es la orden.
 *
 * Las visitas llegan marcadas desde afuera; el plan se deduce de las líneas.
 * **Las visitas pueden ser varias** —cobrar el mes entero de alguien en una
 * orden es lo normal— y por eso viven en `OrdenVisita`. Los planes no: cada
 * orden cubre un período de uno, y dos planes en la misma orden siguen siendo
 * una orden mal armada.
 */
async function origenDeLaOrden(
  lineas: LineaOrdenInput[],
  visitaIds: string[]
): Promise<{ visitaIds: string[]; suscripcionId: string | null }> {
  const planes = [
    ...new Set(
      lineas
        .map((l) => l.suscripcionId)
        .filter((id): id is string => !!id)
    ),
  ];
  if (planes.length > 0) {
    if (planes.length > 1) {
      throw new ValidationError(
        "Una orden es de una sola suscripción. Armá una orden por plan."
      );
    }
    return { visitaIds: [], suscripcionId: planes[0] ?? null };
  }

  return { visitaIds, suscripcionId: null };
}

/**
 * Todo lo que la orden dice cubrir tiene que ser del mismo cliente. Es lo que
 * impide facturarle a alguien el trabajo de otro pasando un id a mano.
 */
async function ensureProcedenciaDelCliente(
  clienteId: string,
  lineas: LineaOrdenInput[],
  visitaIds: string[]
): Promise<void> {
  const suscripcionIds = [
    ...new Set(
      lineas.map((l) => l.suscripcionId).filter((id): id is string => !!id)
    ),
  ];

  if (visitaIds.length > 0) {
    const validas = await prisma.visita.count({
      where: { id: { in: visitaIds }, clienteId, deletedAt: null },
    });
    if (validas !== new Set(visitaIds).size) {
      throw new ValidationError(
        "Alguna de las visitas no es de este cliente."
      );
    }
  }

  if (suscripcionIds.length > 0) {
    const validos = await prisma.suscripcion.count({
      where: { id: { in: suscripcionIds }, clienteId },
    });
    if (validos !== suscripcionIds.length) {
      throw new ValidationError(
        "Alguna de las líneas apunta a una suscripción que no es de este cliente."
      );
    }
  }
}

export interface GenerarOrdenPayload {
  clienteId: string;
  desde: Date;
  hasta: Date;
  fecha?: Date;
  notas?: string | null;
}

/**
 * Arma una orden en BORRADOR con todo lo pendiente del rango.
 *
 * Es idempotente por construcción: si algo ya está en otra orden, los índices
 * únicos de `OrdenLinea` lo rechazan aunque dos personas generen a la vez.
 */
export async function generarOrden(
  viewer: Viewer,
  payload: GenerarOrdenPayload
) {
  ensureCanWrite(viewer);
  await ensureClienteVisible(viewer, payload.clienteId);

  const pendientes = await listarPendientes(
    viewer,
    payload.clienteId,
    payload.desde,
    payload.hasta
  );
  if (pendientes.length === 0) {
    throw new ValidationError("No hay nada pendiente de facturar en ese rango.");
  }

  // **Una orden por suscripción.** Cada plan es un acuerdo aparte y se renueva
  // por su cuenta; juntarlos daría una orden cuyo total no se puede explicar.
  const porSuscripcion = new Map<string, Pendiente[]>();
  for (const p of pendientes) {
    const clave = p.suscripcionId;
    porSuscripcion.set(clave, [...(porSuscripcion.get(clave) ?? []), p]);
  }

  const ordenes = [];
  for (const ps of porSuscripcion.values()) {
    ordenes.push(
      await crearOrden(viewer, {
        clienteId: payload.clienteId,
        fecha: payload.fecha,
        notas: payload.notas,
        lineas: ps.map(lineaDesdePendiente),
      })
    );
  }

  return ordenes;
}

/**
 * Traduce un período pendiente a la línea de orden que lo representa: una
 * sola, sin producto, con el precio pactado del plan.
 */
export function lineaDesdePendiente(p: Pendiente): LineaOrdenInput {
  return {
    descripcion: p.descripcion,
    cantidad: 1,
    precioUnitario: Number(p.precio),
    ivaTasa: Number(p.ivaTasa),
    productoId: null,
    suscripcionId: p.suscripcionId,
    periodoInicio: p.periodoInicio,
    periodoFin: p.periodoFin,
  };
}

// ──────────────────────────────────────────────
// Qué falta cobrar, en todo el negocio
// ──────────────────────────────────────────────

export interface OrdenPorCobrar {
  id: string;
  numero: number;
  fecha: Date;
  total: number;
  productos: number;
  factura: {
    numero: string;
    estado: string;
    fechaEmision: Date;
    saldo: number;
    /** `false` si nunca se sincronizó: el saldo es una suposición. */
    sincronizada: boolean;
  };
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  /** En qué propiedades se trabajó: las de sus visitas, o la de su plan. */
  propiedades: string[];
}

/**
 * Órdenes facturadas a las que todavía les falta cobrar.
 *
 * Una fila por orden, no por cliente: la deuda **es** una factura concreta con
 * su número, no un total que alguien tenga que desglosar después.
 *
 * Antes acá vivían las órdenes por facturar. Dejó de tener sentido cuando
 * confirmar pasó a emitir: lo que queda sin factura es un borrador, y un
 * borrador es trabajo por aprobar, no plata por entrar.
 */
export async function listarOrdenesPorCobrar(
  viewer: Viewer
): Promise<OrdenPorCobrar[]> {
  ensureCanRead(viewer);

  // Facturada y con saldo. Un `saldo` en `null` es una factura que nunca se
  // sincronizó: entra igual, porque no saber cuánto falta no es lo mismo que
  // saber que no falta nada.
  const where: Prisma.OrdenWhereInput = {
    estado: "CONFIRMADA",
    facturas: {
      some: { ...FACTURA_VIGENTE, OR: [{ saldo: null }, { saldo: { gt: 0 } }] },
    },
    cliente: { deletedAt: null },
  };

  const ordenes = await prisma.orden.findMany({
    where,
    select: {
      id: true,
      numero: true,
      fecha: true,
      total: true,
      _count: { select: { lineas: true } },
      facturas: {
        where: FACTURA_VIGENTE,
        select: { numero: true, estado: true, saldo: true, fechaEmision: true },
        take: 1,
      },
      cliente: {
        select: { id: true, nombre: true, apellido: true, empresa: true },
      },
      // Dónde se trabajó, para distinguir dos órdenes del mismo cliente en una
      // lista que es justamente de varias por cliente.
      ...PROPIEDADES_DE_LA_ORDEN,
    },
    orderBy: { fecha: "asc" },
  });

  return ordenes.map((o) => {
    const f = o.facturas[0];
    return {
      id: o.id,
      numero: o.numero,
      fecha: o.fecha,
      total: Number(o.total),
      productos: o._count.lineas,
      factura: {
        numero: f.numero,
        estado: f.estado,
        fechaEmision: f.fechaEmision,
        // Sin sincronizar se asume todo pendiente: es el número prudente.
        saldo: f.saldo === null ? Number(o.total) : Number(f.saldo),
        sincronizada: f.saldo !== null,
      },
      cliente: o.cliente,
      propiedades: propiedadesDeLaOrden(o).map((p) => p.nombre),
    };
  });
}

/**
 * De qué propiedad es una orden, para decirlo en una fila.
 *
 * La de un plan es la del plan —el plan es de un jardín—; la de unas visitas
 * son las de esas visitas, que pueden ser dos casas del mismo cliente si se le
 * cobra el mes entero de una vez. Una orden suelta no tiene ninguna.
 */
export const PROPIEDADES_DE_LA_ORDEN = {
  visitas: {
    select: {
      visita: { select: { propiedad: { select: { id: true, nombre: true } } } },
    },
  },
  suscripcion: {
    select: { propiedad: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.OrdenSelect;

export function propiedadesDeLaOrden(
  orden: Prisma.OrdenGetPayload<{ select: typeof PROPIEDADES_DE_LA_ORDEN }>
): { id: string; nombre: string }[] {
  if (orden.suscripcion) return [orden.suscripcion.propiedad];
  return propiedadesDeVisitas(orden.visitas.map((v) => v.visita));
}

/*
 * Acá vivía `generarBorradoresDeVisitas`: una red de seguridad que le armaba un
 * borrador de orden a toda visita completada que se hubiera quedado sin una.
 *
 * Se fue con los productos de la visita. Una visita ya no deja "trabajo suelto
 * por cobrar" —lo que deja son tareas hechas, que no tienen precio— así que no
 * hay nada que un proceso automático pueda poner en una orden: qué se le cobra
 * al cliente por ese trabajo es una decisión que alguien toma armando la orden
 * a mano, y ahí puede marcar las visitas que cubre.
 *
 * El endpoint que la llamaba se fue con ella. El cron de renovaciones, que arma
 * los borradores de los períodos de suscripción, sigue igual: ahí el precio ya
 * está pactado y por eso se puede automatizar.
 */

/**
 * Cuántos borradores esperan que alguien los revise.
 *
 * Los crea el cron de renovaciones y no se facturan solos: la decisión de
 * cobrar sigue siendo de una persona. Se cuentan para que la salida del cron no
 * quede invisible.
 */
export async function borradoresSinConfirmar(viewer: Viewer): Promise<number> {
  ensureCanRead(viewer);
  const where: Prisma.OrdenWhereInput = {
    estado: "BORRADOR",
    cliente: { deletedAt: null },
  };
  return prisma.orden.count({ where });
}



/**
 * Períodos de suscripción vencidos que **no** tienen orden.
 *
 * En condiciones normales esto es cero: el cron los crea todos los días. Si no
 * lo es, algo falló — el cron no corrió, o la suscripción se omitió por no
 * tener ningún producto activo.
 *
 * Es la red de seguridad de que el cobro no dependa de que un proceso invisible
 * haya funcionado. Sin esto, un cron caído se descubre cuando el cliente
 * pregunta por qué no le llegó la factura.
 */
/**
 * Períodos vencidos sin orden, **desglosados por suscripción**.
 *
 * El desglose es lo que permite hacer algo con el dato: el resumen suelto decía
 * "faltan 52 períodos" sin nombrar ninguno, y generar a ciegas desde ahí no es
 * una decisión, es un salto de fe.
 */
export async function periodosSinOrdenPorSuscripcion(
  viewer: Viewer
): Promise<Map<string, { cantidad: number; total: number }>> {
  ensureCanRead(viewer);

  const suscripciones = await prisma.suscripcion.findMany({
    where: { estado: "ACTIVO", cliente: { deletedAt: null } },
    select: {
      id: true,
      periodicidad: true,
      fechaInicio: true,
      precio: true,
      ivaTasa: true,
      ordenLineas: { select: { periodoInicio: true } },
    },
  });

  const hasta = new Date();
  const porSuscripcion = new Map<string, { cantidad: number; total: number }>();

  for (const sus of suscripciones) {
    let cantidad = 0;
    let total = 0;
    const facturados = new Set(
      sus.ordenLineas
        .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
        .filter(Boolean) as string[]
    );
    for (const { inicio } of periodosDeSuscripcion(
      sus.fechaInicio,
      sus.periodicidad,
      hasta
    )) {
      if (facturados.has(clavePeriodo(inicio))) continue;
      cantidad++;
      total += Number(sus.precio) * (1 + Number(sus.ivaTasa) / 100);
    }
    if (cantidad > 0) {
      porSuscripcion.set(sus.id, {
        cantidad,
        total: Math.round(total * 100) / 100,
      });
    }
  }

  return porSuscripcion;
}

/** El resumen de lo anterior, para el aviso de "Por facturar". */
export async function periodosSinOrden(viewer: Viewer): Promise<{
  cantidad: number;
  total: number;
  suscripciones: number;
}> {
  const detalle = await periodosSinOrdenPorSuscripcion(viewer);
  let cantidad = 0;
  let total = 0;
  for (const d of detalle.values()) {
    cantidad += d.cantidad;
    total += d.total;
  }
  return {
    cantidad,
    total: Math.round(total * 100) / 100,
    suscripciones: detalle.size,
  };
}

// ──────────────────────────────────────────────
// Renovaciones automáticas
// ──────────────────────────────────────────────

export interface ResultadoRenovaciones {
  creadas: { ordenId: string; numero: number; clienteId: string; periodo: string }[];
}

/**
 * Crea en BORRADOR las órdenes de los períodos de suscripción ya vencidos.
 *
 * Corre desde el cron, sin viewer: es un proceso del sistema, no de una
 * persona. Por eso deja todo en borrador — la decisión de cobrar sigue siendo
 * humana, y hasta confirmarla se puede ajustar el precio o sumarle un adicional.
 *
 * Es **idempotente**: los períodos que ya tienen línea de orden se saltean, y si
 * dos corridas se pisaran el índice único `[suscripcionId, periodoInicio]`
 * rechaza la segunda. Correrlo de más no rompe nada.
 *
 * Una orden por suscripción y período, con una sola línea: el plan tiene un
 * precio, no una lista.
 */
export async function generarRenovaciones(
  hasta: Date = new Date(),
  /** Solo esta suscripción. Es la corrida a mano desde su ficha. */
  suscripcionId?: string
): Promise<ResultadoRenovaciones> {
  const resultado: ResultadoRenovaciones = { creadas: [] };

  const suscripciones = await prisma.suscripcion.findMany({
    where: {
      estado: "ACTIVO",
      cliente: { deletedAt: null },
      ...(suscripcionId ? { id: suscripcionId } : {}),
    },
    include: PLAN_PARA_COBRAR_INCLUDE,
  });

  for (const sus of suscripciones) {
    const facturados = new Set(
      sus.ordenLineas
        .map((l) => (l.periodoInicio ? clavePeriodo(l.periodoInicio) : null))
        .filter(Boolean) as string[]
    );

    for (const periodo of periodosDeSuscripcion(
      sus.fechaInicio,
      sus.periodicidad,
      hasta
    )) {
      const clave = clavePeriodo(periodo.inicio);
      if (facturados.has(clave)) continue;

      const { lineas, subtotal, iva } = armarLineas([
        {
          descripcion: descripcionDelPeriodo(sus, periodo),
          cantidad: 1,
          precioUnitario: Number(sus.precio),
          ivaTasa: Number(sus.ivaTasa),
          productoId: null,
          suscripcionId: sus.id,
          periodoInicio: periodo.inicio,
          periodoFin: periodo.fin,
        },
      ]);

      try {
        const orden = await prisma.orden.create({
          data: {
            clienteId: sus.clienteId,
            // La cabecera dice de qué plan es, como cuando la orden se arma a
            // mano: sin esto la ficha de la orden no mostraba el plan.
            suscripcionId: sus.id,
            fecha: hoyEnEcuador(),
            estado: "BORRADOR",
            subtotal,
            iva,
            total: centavos(subtotal.add(iva)),
            lineas: { create: lineas },
          },
          select: { id: true, numero: true },
        });
        resultado.creadas.push({
          ordenId: orden.id,
          numero: orden.numero,
          clienteId: sus.clienteId,
          periodo: clave,
        });
      } catch (error) {
        // Otra corrida ganó la carrera: el índice único hizo su trabajo.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  return resultado;
}

// ──────────────────────────────────────────────
// Consulta y transiciones
// ──────────────────────────────────────────────

export async function listarOrdenes(
  viewer: Viewer,
  options: {
    clienteId?: string;
    estado?: string;
    /** Varios estados a la vez; gana sobre `estado` si vienen los dos. */
    estados?: string[];
    /**
     * Si entró la plata. **Se filtra en la base, no sobre la página.**
     *
     * Se hacía en la pantalla, sobre las órdenes que ya habían llegado: con
     * cien traídas y trescientas en la tabla, pedir "Sin cobrar" mostraba las
     * sin cobrar *de esas cien*, y la lista se veía completa. Un filtro que
     * miente sobre lo que no muestra es peor que no tenerlo.
     *
     * La comparación es contra el **total de la factura** y no el de la orden:
     * son el mismo número —la factura se emite por la orden— y estando en la
     * misma fila, Postgres puede comparar las dos columnas.
     */
    cobro?: "SIN_COBRAR" | "PARCIAL" | "COBRADO" | "ANULADA";
    /** Texto libre: el nombre del cliente o el número de la orden. */
    q?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  ensureCanRead(viewer);
  const where: Prisma.OrdenWhereInput = {};
  if (options.clienteId) where.clienteId = options.clienteId;
  if (options.estados?.length) where.estado = { in: options.estados as never[] };
  else if (options.estado) where.estado = options.estado as never;

  const texto = options.q?.trim();
  if (texto) {
    const porCliente = filtroClientePorTexto(texto);
    const numero = numeroBuscado(texto);
    where.OR = [
      ...(porCliente ? [{ cliente: porCliente }] : []),
      ...(numero !== null ? [{ numero }] : []),
    ];
  }

  if (options.cobro === "ANULADA") {
    where.estado = "ANULADA";
  } else if (options.cobro) {
    // Anulada es su propio casillero: una orden anulada no está "sin cobrar",
    // está fuera de la cuenta.
    where.estado = { not: "ANULADA" };
    const saldo =
      options.cobro === "COBRADO"
        ? { lte: 0.001 }
        : options.cobro === "SIN_COBRAR"
          ? { gte: prisma.factura.fields.total }
          : { gt: 0.001, lt: prisma.factura.fields.total };
    where.facturas = { some: { ...FACTURA_VIGENTE, saldo } };
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(0, options.offset ?? 0);
  const [items, total] = await Promise.all([
    prisma.orden.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
        _count: { select: { lineas: true, facturas: true } },
        // De qué casa es, para decirlo en la fila: la de sus visitas, o la de
        // su plan.
        ...PROPIEDADES_DE_LA_ORDEN,
        // La factura viva, para poder decir si está cobrada. El estado de la
        // orden no lo sabe: cobrar es otro eje.
        facturas: {
          where: FACTURA_VIGENTE,
          select: { saldo: true },
          take: 1,
        },
      },
      orderBy: { fecha: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.orden.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function getOrden(viewer: Viewer, id: string) {
  ensureCanRead(viewer);
  const orden = await prisma.orden.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          id: true, nombre: true, apellido: true, empresa: true,
          cedula: true, ruc: true, tipoPersona: true,
          telefono: true, email: true,
        },
      },
      lineas: {
        orderBy: { posicion: "asc" },
        // `producto` es null en la línea de un plan. Las visitas que cubre la
        // orden no se leen por acá: no salen de las líneas, viven en
        // `OrdenVisita` porque alguien las marcó.
        include: { producto: true },
      },
      facturas: {
        orderBy: { createdAt: "desc" },
        include: {
          // Lo que salió impreso. Puede no tener la forma de las líneas de la
          // orden: varios trabajos se cobran como una sola línea.
          lineas: { orderBy: { posicion: "asc" } },
          datoFacturacion: {
            select: {
              tipoIdentificacion: true,
              tipoPersona: true,
              direccion: true,
              telefono: true,
              email: true,
            },
          },
        },
      },
      // De qué es la orden. Sale de su propia tabla y no de dar la vuelta por
      // las líneas: agregarle un producto suelto a mano no la vuelve otra cosa,
      // y con las líneas la respuesta cambiaba según lo que llevara.
      visitas: {
        select: {
          visita: {
            select: {
              id: true,
              numero: true,
              fechaProgramada: true,
              // Dónde se trabajó. La orden no tiene propiedad propia: sale de
              // las visitas que cubre, que pueden ser de dos casas del mismo
              // cliente si se le cobra el mes entero en una sola orden.
              propiedad: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      suscripcion: {
        select: {
          id: true,
          numero: true,
          periodicidad: true,
          estado: true,
          // De qué jardín es el plan: es la propiedad de la orden.
          propiedad: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  if (!orden) throw new NotFoundError("Orden no encontrada");
  return orden;
}

export async function liberarProcedencia(
  tx: Prisma.TransactionClient,
  ordenId: string
) {
  // La orden deja de decir de qué visitas es y suelta el período del plan. Lo
  // segundo es lo que importa de verdad: `[suscripcionId, periodoInicio]` es
  // único **en toda la tabla**, sin mirar el estado de la orden, así que un
  // período que se quedara enlazado a una orden muerta no se podría volver a
  // facturar nunca. Las fechas del período se quedan: son historia —de qué mes
  // era esa orden anulada— y sin el plan ya no chocan con nada.
  await tx.ordenVisita.deleteMany({ where: { ordenId } });
  await tx.ordenLinea.updateMany({
    where: { ordenId },
    data: { suscripcionId: null },
  });
}

/**
 * Anular es el final del camino de una orden: no se reabre ni se vuelve a
 * facturar. Para volver a cobrar ese trabajo se arma una orden nueva.
 *
 * **No se anula una orden con trabajo enlazado sin decirlo.** Una visita o un
 * período que se van con la orden no vuelven nunca: los índices únicos de
 * procedencia no miran el estado, así que ese trabajo quedaría reservado por
 * una orden muerta, invisible en "pendientes" e imposible de meter en otra.
 * Por eso hay que pedirlo con `liberarTrabajo`, después de ver la lista.
 *
 * Una orden **facturada** no se anula por acá: primero va su factura, y de eso
 * se ocupa `anularOrdenCompleta` en `factura.service`.
 */
export async function anularOrden(
  viewer: Viewer,
  id: string,
  opciones: { liberarTrabajo?: boolean } = {}
) {
  ensureCanWrite(viewer);
  const orden = await getOrden(viewer, id);
  if (orden.estado === "CONFIRMADA") {
    throw new ConflictError(
      "Esta orden ya tiene factura. Hay que anular la factura primero."
    );
  }

  // Lo que hay que soltar a propósito son los **períodos de suscripción**:
  // `[suscripcionId, periodoInicio]` es único en toda la tabla sin mirar el
  // estado, así que un período que se quedara pegado a una orden anulada no se
  // podría volver a facturar nunca. Las visitas marcadas no tienen ese
  // problema —son traza, no reserva— pero se sueltan en el mismo gesto y la
  // pregunta las nombra, porque la orden deja de decir por qué existe.
  const conPeriodo = orden.lineas.filter((l) => l.suscripcionId).length;
  if (
    (conPeriodo > 0 || orden.visitas.length > 0) &&
    !opciones.liberarTrabajo
  ) {
    const partes = [
      conPeriodo > 0
        ? `${conPeriodo} ${conPeriodo === 1 ? "línea de un plan" : "líneas de un plan"}`
        : null,
      orden.visitas.length > 0
        ? `${orden.visitas.length} ${orden.visitas.length === 1 ? "visita" : "visitas"}`
        : null,
    ].filter(Boolean);
    throw new ConflictError(
      `Esta orden cubre ${partes.join(" y ")}. Hay que desenlazarlas antes de anular, o el período queda sin poder facturarse.`
    );
  }

  return prisma.$transaction(async (tx) => {
    await liberarProcedencia(tx, id);
    return tx.orden.update({
      where: { id },
      data: { estado: "ANULADA", updatedById: viewer.id },
    });
  });
}

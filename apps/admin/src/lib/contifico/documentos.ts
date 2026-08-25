/**
 * Emisión de facturas en Contífico.
 *
 * Contífico genera el XML, firma electrónicamente y transmite al SRI, así que
 * el portal no implementa nada de eso: manda el documento y consulta el estado.
 *
 * Dos cosas verificadas que condicionan el diseño:
 * - El cliente va **embebido** en el documento. Contífico crea la persona sola
 *   y la reusa si la cédula ya existe, así que no hay padrón que sincronizar.
 * - Los documentos son **inmutables por API**: `PATCH` da 405 y `PUT` da 400.
 *   Una vez emitida, una factura solo se corrige desde Contífico o con nota de
 *   crédito. Por eso el portal confirma antes de emitir.
 */
import { contificoRequest, fechaContifico, posToken } from "./client";

export interface ClienteFacturacion {
  cedula: string | null;
  ruc: string | null;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA" | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

export interface LineaFactura {
  contificoProductoId: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
}

export interface DocumentoCreado {
  id: string;
  documento: string;
  estado: string;
  persona_id: string | null;
  autorizacion: string | null;
  url_ride: string | null;
  url_xml: string | null;
  total: string;
}

/**
 * El documento tal como lo devuelve Contífico.
 *
 * Ojo con los dos "estado": este es el de cobro (`P` pendiente, `C` cobrado,
 * `G` pagado, `A` anulado, `E` generado, `F` facturado), y **no** es lo que
 * devuelve `GET /documento/<id>/estado/`, que es el avance de la firma
 * electrónica. Ver `.claude/docs/facturacion-contifico.md`.
 */
/** Un cobro registrado contra un documento. */
export interface CobroContifico {
  id: string;
  forma_cobro: string;
  monto: string;
  fecha: string | null;
  /**
   * Ojo: en efectivo **no es un dato del usuario**. Contífico lo pisa con su
   * propia etiqueta y devuelve `"Efectivo"`, así que mostrarlo ahí es mostrar
   * ruido. Solo tiene sentido en transferencia.
   */
  numero_comprobante: string | null;
  numero_cheque: string | null;
  fecha_cheque: string | null;
  /** En qué cuenta del vivero cayó la transferencia. */
  cuenta_bancaria_id: string | null;
  /** Datáfono: `D` datafast, `M` medianet, `E` dataexpress, `P` placetopay, `A` alignet. */
  tipo_ping: string | null;
  numero_tarjeta: string | null;
  nombre_tarjeta: string | null;
  lote: string | null;
}

export interface DocumentoContifico {
  id: string;
  documento: string;
  estado: string;
  cobros?: CobroContifico[];
  /** Redundante con `estado === "A"`, y más explícito. */
  anulado: boolean;
  /** Lo que falta cobrar. `0` cuando está saldado. */
  saldo: string;
  total: string;
  /**
   * Llegan vacíos al emitir y aparecen recién cuando Contífico firma —cosa que
   * hace sola, en su proceso horario—, así que hay que releerlos al sincronizar.
   */
  url_ride?: string | null;
  url_xml?: string | null;
}

/**
 * El documento completo.
 *
 * Hace falta además de `consultarEstado()` porque ese endpoint **no delata una
 * anulación**: sobre un documento con `estado: "A"` devuelve "No se ha firmado",
 * igual que uno recién creado. Verificado contra el sandbox.
 */
export async function obtenerDocumento(
  documentoId: string
): Promise<DocumentoContifico> {
  return contificoRequest<DocumentoContifico>(`/documento/${documentoId}/`);
}

/** Los cuatro estados que devuelve `GET /documento/<id>/estado/`. */
export type EstadoSri =
  | "No se ha firmado"
  | "Firmado"
  | "Enviado SRI"
  | "Autorizado";

const ESTADOS: Record<string, string> = {
  "No se ha firmado": "PENDIENTE",
  Firmado: "FIRMADO",
  "Enviado SRI": "ENVIADO_SRI",
  Autorizado: "AUTORIZADO",
};

export function mapearEstado(estadoSri: string): string {
  return ESTADOS[estadoSri] ?? "PENDIENTE";
}

/** Establecimiento y punto de emisión con los que emite el portal. */
export function serie(): { establecimiento: string; puntoEmision: string } {
  return {
    establecimiento: process.env.CONTIFICO_ESTABLECIMIENTO ?? "001",
    // Conviene un punto de emisión propio del portal: si comparte serie con lo
    // que emiten a mano en Contífico, los secuenciales chocan.
    puntoEmision: process.env.CONTIFICO_PUNTO_EMISION ?? "002",
  };
}

export function formatearNumero(secuencial: number): string {
  const { establecimiento, puntoEmision } = serie();
  return `${establecimiento}-${puntoEmision}-${String(secuencial).padStart(9, "0")}`;
}

export interface EmitirDocumentoInput {
  numero: string;
  fechaEmision: Date;
  cliente: ClienteFacturacion;
  lineas: LineaFactura[];
  descripcion?: string | null;
  /** Con `true` Contífico firma y transmite al SRI. */
  electronico?: boolean;
}

/** Redondeo a centavos sin acarrear error de punto flotante. */
const centavos = (n: number) => Math.round(n * 100) / 100;

export function calcularTotales(lineas: LineaFactura[]) {
  let subtotal0 = 0;
  let subtotalGravado = 0;
  let iva = 0;
  const detalles = lineas.map((l) => {
    const base = centavos(l.cantidad * l.precioUnitario);
    const ivaLinea = centavos((base * l.ivaTasa) / 100);
    if (l.ivaTasa > 0) subtotalGravado += base;
    else subtotal0 += base;
    iva += ivaLinea;
    return {
      producto_id: l.contificoProductoId,
      cantidad: l.cantidad,
      precio: l.precioUnitario,
      porcentaje_iva: l.ivaTasa,
      porcentaje_descuento: 0,
      base_cero: l.ivaTasa > 0 ? 0 : base,
      base_gravable: l.ivaTasa > 0 ? base : 0,
      base_no_gravable: 0,
    };
  });
  subtotal0 = centavos(subtotal0);
  subtotalGravado = centavos(subtotalGravado);
  iva = centavos(iva);
  return {
    detalles,
    subtotal0,
    subtotalGravado,
    iva,
    total: centavos(subtotal0 + subtotalGravado + iva),
  };
}

export async function emitirDocumento(
  input: EmitirDocumentoInput
): Promise<DocumentoCreado> {
  const totales = calcularTotales(input.lineas);
  const electronico = input.electronico ?? true;

  return contificoRequest<DocumentoCreado>("/documento/", {
    method: "POST",
    timeoutMs: 60_000,
    body: {
      pos: posToken(),
      fecha_emision: fechaContifico(input.fechaEmision),
      tipo_documento: "FAC",
      tipo_registro: "CLI",
      documento: input.numero,
      estado: "P",
      electronico,
      // En documentos electrónicos va vacía: la genera Contífico.
      autorizacion: "",
      caja_id: null,
      cliente: {
        cedula: input.cliente.cedula ?? "",
        ruc: input.cliente.ruc ?? "",
        razon_social: input.cliente.razonSocial,
        telefonos: input.cliente.telefono ?? "",
        direccion: input.cliente.direccion ?? "",
        tipo: input.cliente.tipoPersona === "JURIDICA" ? "J" : "N",
        email: input.cliente.email ?? "",
        es_extranjero: false,
      },
      descripcion: input.descripcion ?? "",
      subtotal_0: totales.subtotal0,
      // El campo conserva el nombre viejo, pero lleva la base gravada al 15%.
      subtotal_12: totales.subtotalGravado,
      iva: totales.iva,
      ice: 0,
      total: totales.total,
      detalles: totales.detalles,
    },
  });
}

/**
 * Anula un documento en Contífico.
 *
 * No hay endpoint de anulación: se hace con `PUT /documento/` —a la
 * **colección**, con el `id` en el cuerpo— y **todos** los campos de creación.
 * Probado contra el sandbox el 23/08/2026; los caminos que no funcionan están
 * en `.claude/docs/facturacion-contifico.md`.
 *
 * Dos cosas que cuestan caro si se olvidan:
 *
 * 1. **`estado` es de solo lectura.** Mandar `estado: "A"` devuelve 200 y no
 *    anula nada; lo que manda es el booleano `anulado`. Contífico deriva el
 *    estado.
 * 2. **El PUT reemplaza el documento entero.** Uno que no mande `anulado: true`
 *    lo *desanula*. Si algún día se usa este PUT para otra cosa, hay que
 *    arrastrar el campo.
 */
export async function anularDocumento(documentoId: string): Promise<void> {
  const d = await contificoRequest<Record<string, unknown>>(
    `/documento/${documentoId}/`
  );
  const persona = (d.persona ?? {}) as Record<string, unknown>;
  const detalles = (d.detalles ?? []) as Record<string, unknown>[];
  const cobros = (d.cobros ?? []) as Record<string, unknown>[];

  await contificoRequest("/documento/", {
    method: "PUT",
    timeoutMs: 60_000,
    body: {
      id: documentoId,
      pos: d.pos,
      fecha_emision: d.fecha_emision,
      tipo_documento: d.tipo_documento,
      tipo_registro: d.tipo_registro,
      documento: d.documento,
      electronico: d.electronico,
      autorizacion: d.autorizacion ?? "",
      caja_id: d.caja_id,
      cliente: {
        cedula: persona.cedula ?? "",
        ruc: persona.ruc ?? "",
        razon_social: persona.razon_social ?? "",
        telefonos: persona.telefonos ?? "",
        direccion: persona.direccion ?? "",
        tipo: persona.tipo ?? "N",
        email: persona.email ?? "",
        es_extranjero: false,
      },
      descripcion: d.descripcion ?? "",
      // Un solo campo por subtotal: mandarlos todos da "Llenar un solo campo
      // subtotal".
      subtotal_0: d.subtotal_0,
      subtotal_12: d.subtotal_12,
      iva: d.iva,
      ice: 0,
      total: d.total,
      detalles: detalles.map((x) => ({
        producto_id: x.producto_id,
        cantidad: x.cantidad,
        precio: x.precio,
        porcentaje_iva: x.porcentaje_iva,
        porcentaje_descuento: 0,
        base_cero: x.base_cero,
        base_gravable: x.base_gravable,
        base_no_gravable: 0,
      })),
      // **Van sí o sí, aunque anular no tenga nada que ver con ellos.** Este
      // PUT reemplaza el documento entero: omitir la clave `cobros` le borra
      // los cobros. Lo aprendimos con la 001-002-000900011, que tenía un cobro
      // de $144.54 registrado y quedó en cero después de anularla.
      //
      // Un efectivo vuelve como `CAJA` y hay que remandarlo como `EF`, que es
      // el código que el POST acepta.
      cobros: cobros.map((c) => ({
        forma_cobro: c.forma_cobro === "CAJA" ? "EF" : c.forma_cobro,
        monto: c.monto,
        fecha: c.fecha,
        cuenta_bancaria_id: c.cuenta_bancaria_id,
        numero_cheque: c.numero_cheque,
        tipo_ping: c.tipo_ping,
      })),
      estado: "P",
      anulado: true,
    },
  });
}

/** Cómo se cobró. Son los códigos que acepta Contífico. */
export type FormaCobro = "EF" | "CQ" | "TRA" | "TC";

export interface CobroInput {
  formaCobro: FormaCobro;
  monto: number;
  /** `YYYY-MM-DD`. Sin esto Contífico usa la fecha del día. */
  fecha?: string | null;
  /** Solo cheque. */
  numeroCheque?: string | null;
  /** Obligatorio en transferencia: id de la cuenta cargada en Contífico. */
  cuentaBancariaId?: string | null;
  /** Obligatorio en tarjeta: D datafast, M medianet, E dataexpress, P placetopay, A alignet. */
  tipoPing?: string | null;
  numeroComprobante?: string | null;
}

/**
 * Registra un cobro contra una factura.
 *
 * Los cobros son de Contífico: el portal no lleva los suyos, solo los manda y
 * después relee el `saldo`. Se pueden registrar varios, y el documento pasa a
 * `estado: "C"` recién cuando el saldo llega a cero.
 */
export async function registrarCobro(
  documentoId: string,
  cobro: CobroInput
): Promise<void> {
  await contificoRequest(`/documento/${documentoId}/cobro/`, {
    method: "POST",
    timeoutMs: 60_000,
    body: {
      forma_cobro: cobro.formaCobro,
      monto: cobro.monto.toFixed(2),
      ...(cobro.fecha ? { fecha: fechaContifico(new Date(`${cobro.fecha}T00:00:00Z`)) } : {}),
      ...(cobro.numeroCheque ? { numero_cheque: cobro.numeroCheque } : {}),
      ...(cobro.cuentaBancariaId
        ? { cuenta_bancaria_id: cobro.cuentaBancariaId }
        : {}),
      ...(cobro.tipoPing ? { tipo_ping: cobro.tipoPing } : {}),
      ...(cobro.numeroComprobante
        ? { numero_comprobante: cobro.numeroComprobante }
        : {}),
    },
  });
}

export async function consultarEstado(
  documentoId: string
): Promise<{ estado: string }> {
  return contificoRequest<{ estado: string }>(
    `/documento/${documentoId}/estado/`
  );
}

/** Fuerza el envío al SRI. Contífico igual manda los pendientes cada hora. */
export async function enviarAlSri(documentoId: string): Promise<void> {
  await contificoRequest(`/documento/${documentoId}/sri/`, {
    method: "PUT",
    timeoutMs: 60_000,
  });
}

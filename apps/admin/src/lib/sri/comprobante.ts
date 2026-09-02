/**
 * De una orden del portal al comprobante que entiende el SRI.
 *
 * Es la traducción, nada más: no decide qué se factura ni toca la base. Lo que
 * entra son las líneas ya resueltas —las mismas que hoy arma el emisor de
 * documentos— y lo que sale es el objeto que la librería convierte en XML.
 *
 * **Acá se ve lo que cambia al dejar Contífico**: la línea del SRI lleva un
 * código y una descripción *nuestros*. No hay `producto_id` de nadie, así que
 * no hay que vincular nada con ningún catálogo ajeno para poder facturar.
 */
import { IMPUESTOS_IVA } from "facturacion-electronica-ec";

/** Los dos decimales con los que se declara todo. */
const centavos = (n: number) => Math.round(n * 100) / 100;

export interface LineaComprobante {
  /** El código del producto en el portal. Es lo que sale impreso al lado. */
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** Porcentaje: 0, 5, 12, 15. */
  ivaTasa: number;
  descuento?: number;
}

export interface CompradorComprobante {
  tipoIdentificacion: "CEDULA" | "RUC" | "PASAPORTE";
  identificacion: string;
  razonSocial: string;
  direccion?: string | null;
}

/**
 * El código con el que el SRI nombra cada tarifa de IVA.
 *
 * Se resuelve contra el catálogo de la librería en vez de escribir "4" a mano:
 * las tarifas cambian —el 12% pasó a 15% en 2024— y un número quemado en el
 * código es justo lo que hace que la próxima vez falle en silencio.
 */
function codigoIva(tasa: number): string {
  const entrada = Object.values(IMPUESTOS_IVA).find(
    (i) => i.rate === tasa && i.code !== "6" && i.code !== "7" && i.code !== "8"
  );
  if (!entrada) {
    throw new Error(
      `El SRI no tiene un código para una tarifa de IVA del ${tasa}%.`
    );
  }
  return entrada.code;
}

/**
 * Con qué código viaja la identificación del comprador.
 *
 * Los trece nueves son el consumidor final, que tiene su propio código y no es
 * "una cédula rara": mandarlo como cédula lo rechaza el SRI.
 */
export function tipoIdentificacionSri(comprador: CompradorComprobante): string {
  if (comprador.identificacion === "9999999999999") return "07";
  if (comprador.tipoIdentificacion === "RUC") return "04";
  if (comprador.tipoIdentificacion === "PASAPORTE") return "06";
  return "05";
}

/** `dd/mm/yyyy`, que es como el SRI pide las fechas. */
export function fechaSri(fecha: Date): string {
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${fecha.getUTCFullYear()}`;
}

export interface DatosFactura {
  fechaEmision: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalConImpuestos: {
    codigo: string;
    codigoPorcentaje: string;
    baseImponible: number;
    valor: number;
  }[];
  propina: number;
  importeTotal: number;
  pagos: { formaPago: string; total: number }[];
  detalles: {
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    impuestos: {
      codigo: string;
      codigoPorcentaje: string;
      tarifa: number;
      baseImponible: number;
      valor: number;
    }[];
  }[];
}

/**
 * `01` = sin utilización del sistema financiero.
 *
 * El SRI exige declarar una forma de pago al emitir, pero la factura se emite
 * antes de saber cómo van a pagarla —acá se cobra después, y a veces en
 * cuotas—. Se declara la más neutra y el cobro real vive en el portal, que es
 * donde se registra. Cambiarla después no altera el comprobante.
 */
const FORMA_PAGO_POR_DEFECTO = "01";

export function armarFactura(
  comprador: CompradorComprobante,
  lineas: LineaComprobante[],
  opciones: { fecha: Date; formaPago?: string }
): DatosFactura {
  if (lineas.length === 0) {
    throw new Error("La factura no tiene líneas.");
  }

  const detalles = lineas.map((l) => {
    const descuento = centavos(l.descuento ?? 0);
    const base = centavos(l.cantidad * l.precioUnitario - descuento);
    const codigo = codigoIva(l.ivaTasa);
    return {
      codigoPrincipal: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      descuento,
      precioTotalSinImpuesto: base,
      impuestos: [
        {
          codigo: "2", // 2 = IVA, en el catálogo de impuestos del SRI
          codigoPorcentaje: codigo,
          tarifa: l.ivaTasa,
          baseImponible: base,
          valor: centavos((base * l.ivaTasa) / 100),
        },
      ],
    };
  });

  // Un renglón por tarifa, que es como el SRI quiere el encabezado: sumar todo
  // junto haría cuadrar el total y mentir el desglose del IVA.
  const porTarifa = new Map<string, { base: number; valor: number; tarifa: number }>();
  for (const d of detalles) {
    const imp = d.impuestos[0];
    const actual = porTarifa.get(imp.codigoPorcentaje) ?? {
      base: 0,
      valor: 0,
      tarifa: imp.tarifa,
    };
    porTarifa.set(imp.codigoPorcentaje, {
      base: centavos(actual.base + imp.baseImponible),
      valor: centavos(actual.valor + imp.valor),
      tarifa: imp.tarifa,
    });
  }

  const totalSinImpuestos = centavos(
    detalles.reduce((a, d) => a + d.precioTotalSinImpuesto, 0)
  );
  const totalDescuento = centavos(detalles.reduce((a, d) => a + d.descuento, 0));
  const iva = centavos(
    [...porTarifa.values()].reduce((a, t) => a + t.valor, 0)
  );
  const importeTotal = centavos(totalSinImpuestos + iva);

  return {
    fechaEmision: fechaSri(opciones.fecha),
    tipoIdentificacionComprador: tipoIdentificacionSri(comprador),
    razonSocialComprador: comprador.razonSocial,
    identificacionComprador: comprador.identificacion,
    ...(comprador.direccion ? { direccionComprador: comprador.direccion } : {}),
    totalSinImpuestos,
    totalDescuento,
    totalConImpuestos: [...porTarifa.entries()].map(([codigoPorcentaje, t]) => ({
      codigo: "2",
      codigoPorcentaje,
      baseImponible: t.base,
      valor: t.valor,
    })),
    propina: 0,
    importeTotal,
    pagos: [
      {
        formaPago: opciones.formaPago ?? FORMA_PAGO_POR_DEFECTO,
        total: importeTotal,
      },
    ],
    detalles,
  };
}

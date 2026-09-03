/**
 * Junta lo que el RIDE necesita, desde una factura emitida por el portal.
 *
 * Sale todo de lo **guardado**, no de la orden: la factura tiene sus propias
 * líneas y su propio snapshot de a nombre de quién salió, justamente porque
 * pueden diferir de la orden y el papel que recibió el cliente no cambia.
 */
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { FORMA_PAGO_POR_DEFECTO } from "./comprobante";
import { logoDeLaEmpresa } from "./logo";
import type { RideDatos } from "./ride";

export async function datosDelRide(facturaId: string): Promise<RideDatos> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      numero: true,
      tipo: true,
      motivo: true,
      facturaModificada: { select: { numero: true, fechaEmision: true } },
      claveAcceso: true,
      autorizacion: true,
      fechaAutorizacion: true,
      fechaEmision: true,
      razonSocial: true,
      identificacion: true,
      subtotal0: true,
      subtotalGravado: true,
      iva: true,
      total: true,
      datoFacturacion: { select: { direccion: true } },
      emisor: {
        select: {
          razonSocial: true,
          nombreComercial: true,
          ruc: true,
          dirMatriz: true,
          direccionEstablecimiento: true,
          obligadoContabilidad: true,
          contribuyenteEspecial: true,
          agenteRetencion: true,
          ambiente: true,
        },
      },
      lineas: {
        orderBy: { posicion: "asc" },
        select: {
          descripcion: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          total: true,
          producto: { select: { codigo: true, id: true } },
        },
      },
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");

  // El RIDE es la representación de un comprobante **electrónico**: sin emisor
  // ni clave de acceso no hay comprobante que representar.
  if (!factura.emisor || !factura.claveAcceso) {
    throw new ValidationError(
      "Esta factura no la emitió el portal: no tiene RIDE."
    );
  }

  return {
    emisor: factura.emisor,
    tipo: factura.tipo === "NOTA_CREDITO" ? "NOTA_CREDITO" : "FACTURA",
    modifica: factura.facturaModificada
      ? {
          numero: factura.facturaModificada.numero,
          fecha: factura.facturaModificada.fechaEmision,
          motivo: factura.motivo ?? "—",
        }
      : null,
    numero: factura.numero,
    claveAcceso: factura.claveAcceso,
    numeroAutorizacion: factura.autorizacion,
    fechaAutorizacion: factura.fechaAutorizacion,
    fechaEmision: factura.fechaEmision,
    comprador: {
      razonSocial: factura.razonSocial ?? "CONSUMIDOR FINAL",
      identificacion: factura.identificacion ?? "9999999999999",
      direccion: factura.datoFacturacion?.direccion ?? null,
    },
    lineas: factura.lineas.map((l) => ({
      codigo: l.producto.codigo ?? l.producto.id.slice(-10).toUpperCase(),
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      descuento: 0,
      // **Sin impuestos**: esa columna del RIDE es el precio total de la línea
      // antes del IVA. `FacturaLinea.total` lo trae incluido, que es otra cosa.
      totalSinImpuestos: Number(l.subtotal),
    })),
    // Lo que se declaró al emitir. Sale del mismo lugar que el XML para que el
    // papel no diga una forma de pago distinta a la que se mandó.
    pagos: [
      { formaPago: FORMA_PAGO_POR_DEFECTO, total: Number(factura.total) },
    ],
    totalDescuento: 0,
    propina: 0,
    // Que falte no invalida nada: el comprobante sale sin logo.
    logo: await logoDeLaEmpresa(),
    subtotal0: Number(factura.subtotal0),
    subtotalGravado: Number(factura.subtotalGravado),
    iva: Number(factura.iva),
    total: Number(factura.total),
  };
}

/**
 * Junta lo que el RIDE necesita, desde una factura emitida por el portal.
 *
 * Sale todo de lo **guardado**, no de la orden: la factura tiene sus propias
 * líneas y su propio snapshot de a nombre de quién salió, justamente porque
 * pueden diferir de la orden y el papel que recibió el cliente no cambia.
 */
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
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
      descripcion: true,
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
          total: true,
          producto: { select: { codigo: true, id: true } },
        },
      },
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");

  // El RIDE es la representación del comprobante **electrónico**: sin emisor
  // propio la factura la emitió Contífico, y el papel lo hacen ellos.
  if (!factura.emisor || !factura.claveAcceso) {
    throw new ValidationError(
      "Esta factura no la emitió el portal: su RIDE lo genera Contífico."
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
      total: Number(l.total),
    })),
    subtotal0: Number(factura.subtotal0),
    subtotalGravado: Number(factura.subtotalGravado),
    iva: Number(factura.iva),
    total: Number(factura.total),
    descripcion: factura.descripcion,
  };
}

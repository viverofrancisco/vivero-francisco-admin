/**
 * Emitir una factura de prueba contra el SRI.
 *
 * Existe para contestar "¿esto funciona?" antes de que dependa una orden de
 * verdad. Valida de una sola vez las cuatro cosas que pueden estar mal y que de
 * otro modo se descubren una por una: los datos del emisor, el certificado, la
 * numeración y la conexión con el SRI.
 *
 * **Solo en PRUEBAS.** Un emisor en producción emitiría una factura real a
 * nombre del contribuyente, con su número de la serie consumido y su
 * declaración detrás. Eso no es una prueba, es un problema.
 */
import { ValidationError } from "@/lib/services/errors";
import type { Viewer } from "@/lib/services/viewer";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";
import { armarFactura, fechaSri } from "./comprobante";
import { emitirFacturaSri, numeroComprobante } from "./emision";
import { hoyEnEcuador } from "@/lib/fechas";

export async function emitirFacturaDePrueba(viewer: Viewer, emisorId: string) {
  if (viewer.role !== "ADMIN") throw new ForbiddenError();

  const emisor = await prisma.emisor.findUnique({
    where: { id: emisorId },
    select: { id: true, ambiente: true, establecimiento: true, puntoEmision: true },
  });
  if (!emisor) throw new NotFoundError("Emisor no encontrado");
  if (emisor.ambiente !== "PRUEBAS") {
    throw new ValidationError(
      "Este emisor está en producción: emitir una prueba sería emitir una factura real. Pasalo a pruebas para probar."
    );
  }

  // A consumidor final y por un dólar: es el comprobante más inocuo que el SRI
  // acepta, y alcanza para saber si la cadena entera funciona.
  const datos = armarFactura(
    {
      tipoIdentificacion: "CEDULA",
      identificacion: "9999999999999",
      razonSocial: "CONSUMIDOR FINAL",
    },
    [
      {
        codigo: "PRUEBA",
        descripcion: "Prueba de emisión del portal",
        cantidad: 1,
        precioUnitario: 1,
        ivaTasa: 0,
      },
    ],
    { fecha: hoyEnEcuador() }
  );

  const r = await emitirFacturaSri(emisorId, datos);
  return {
    estado: r.estado,
    claveAcceso: r.claveAcceso,
    numero: numeroComprobante(
      emisor.establecimiento,
      emisor.puntoEmision,
      r.secuencial
    ),
    fecha: fechaSri(hoyEnEcuador()),
    numeroAutorizacion: r.numeroAutorizacion,
    fechaAutorizacion: r.fechaAutorizacion,
    mensajes: r.mensajes,
  };
}

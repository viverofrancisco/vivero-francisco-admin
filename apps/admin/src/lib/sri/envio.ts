/**
 * Mandarle la factura al cliente.
 *
 * Van **los dos archivos**: el RIDE en PDF, que es el que la gente abre y lee,
 * y el XML autorizado, que es el documento legal — el que su contador necesita
 * y el único que el SRI reconoce. Mandar solo el PDF es mandarle una foto del
 * comprobante.
 *
 * Queda anotado cuándo y a qué correo se mandó: sin eso nadie sabe si llegó, y
 * el reflejo es volver a mandarla "por si acaso", que del lado del cliente es
 * la misma factura dos veces.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME } from "@/lib/s3";
import { sendEmail } from "@/lib/email";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { renderRide } from "./ride";
import { datosDelRide } from "./ride-datos";

export interface ResultadoEnvio {
  a: string;
  numero: string;
  /** Si el XML pudo adjuntarse. Sin él va solo el PDF, y se avisa. */
  conXml: boolean;
}

export async function enviarFacturaAlCliente(
  facturaId: string,
  /** A dónde mandarla. Sin esto, al correo que tenga cargado el cliente. */
  correo?: string | null
): Promise<ResultadoEnvio> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: {
      id: true,
      numero: true,
      estado: true,
      claveAcceso: true,
      xmlKey: true,
      anulada: true,
      datoFacturacion: { select: { email: true, razonSocial: true } },
      orden: {
        select: {
          numero: true,
          cliente: { select: { email: true, nombre: true } },
        },
      },
    },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");

  if (!factura.claveAcceso) {
    throw new ValidationError(
      "Esta factura no la emitió el portal: no hay comprobante que mandar."
    );
  }
  // Antes de la autorización no hay comprobante que entregar: lo que hay es un
  // XML enviado, y el cliente no tiene nada que hacer con eso.
  if (factura.estado !== "AUTORIZADO") {
    throw new ValidationError(
      "El SRI todavía no la autorizó. Hasta que lo haga no hay comprobante que mandar."
    );
  }
  if (factura.anulada) {
    throw new ValidationError("Esta factura está anulada.");
  }

  const destino =
    correo?.trim() ||
    factura.datoFacturacion?.email?.trim() ||
    factura.orden.cliente.email?.trim();
  if (!destino) {
    throw new ValidationError(
      "El cliente no tiene correo cargado. Agregalo en sus datos de facturación."
    );
  }

  const datos = await datosDelRide(factura.id);
  const pdf = await renderRide(datos);

  // El XML sale de R2. Si no está —una subida que falló al emitir— se manda el
  // PDF igual y se avisa: el cliente necesita el comprobante más que la copia.
  let xml: Buffer | null = null;
  if (factura.xmlKey) {
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: factura.xmlKey })
      );
      xml = Buffer.from(await obj.Body!.transformToByteArray());
    } catch {
      xml = null;
    }
  }

  const nombre = factura.datoFacturacion?.razonSocial ?? datos.comprador.razonSocial;
  const emisor = datos.emisor.nombreComercial || datos.emisor.razonSocial;
  const pruebas = datos.emisor.ambiente === "PRUEBAS";

  const resultado = await sendEmail({
    to: destino,
    subject: `Factura ${factura.numero} · ${emisor}`,
    text: [
      `Hola ${nombre},`,
      ``,
      `Adjuntamos la factura ${factura.numero} por $${datos.total.toFixed(2)}.`,
      `Clave de acceso: ${datos.claveAcceso}`,
      ``,
      `Va el PDF para leerla y el XML, que es el documento que necesita su contador.`,
      pruebas
        ? `\nAVISO: emitida en el ambiente de pruebas del SRI. No tiene validez tributaria.`
        : ``,
      ``,
      emisor,
    ].join("\n"),
    html: `
      <p>Hola ${nombre},</p>
      <p>Adjuntamos la factura <strong>${factura.numero}</strong> por
      <strong>$${datos.total.toFixed(2)}</strong>.</p>
      <p style="color:#555;font-size:13px">Clave de acceso:
      <code>${datos.claveAcceso}</code></p>
      <p>Va el PDF para leerla y el XML, que es el documento que necesita su
      contador.</p>
      ${pruebas ? `<p style="color:#b45309"><strong>Aviso:</strong> emitida en el ambiente de pruebas del SRI. No tiene validez tributaria.</p>` : ""}
      <p>${emisor}</p>
    `,
    attachments: [
      {
        filename: `factura-${factura.numero}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
      ...(xml
        ? [
            {
              filename: `factura-${factura.numero}.xml`,
              content: xml,
              contentType: "application/xml",
            },
          ]
        : []),
    ],
  });

  if (!resultado.success) {
    throw new ValidationError(
      `No pudimos mandar el correo: ${resultado.error ?? "error desconocido"}`
    );
  }

  await prisma.factura.update({
    where: { id: factura.id },
    data: { enviadoEl: new Date(), enviadoA: destino },
  });

  return { a: destino, numero: factura.numero, conXml: xml !== null };
}

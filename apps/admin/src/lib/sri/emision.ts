/**
 * Emitir un comprobante contra el SRI.
 *
 * El esquema del SRI es *offline*: el portal calcula la clave de acceso —que en
 * este esquema **es** el número de autorización—, arma el XML, lo firma con el
 * certificado del emisor, lo manda a recepción y consulta autorización. Nadie
 * nos avisa nada después: hay que preguntar.
 *
 * Esto es solo la puerta hacia el SRI. Qué se factura y qué queda guardado lo
 * decide `factura.service.ts`, igual que hoy con Contífico.
 */
import {
  FacturacionElectronicaEC,
  generateClaveAcceso,
  generateCodigoNumerico,
  type ISequenceProvider,
} from "facturacion-electronica-ec";
import { certificadoParaFirmar } from "@/lib/services/emisor.service";
import { siguienteSecuencial } from "./secuenciales";
import type { DatosFactura } from "./comprobante";

/** El emisor tal como lo necesita la librería, ya con su certificado. */
async function clienteDelEmisor(emisorId: string) {
  const { emisor, p12, password } = await certificadoParaFirmar(emisorId);

  /**
   * La numeración sale de la base, no de un contador en memoria.
   *
   * En serverless el proceso se reinicia todo el tiempo, así que un contador en
   * memoria volvería a empezar en 1 — y el SRI rechaza un número ya usado.
   */
  const secuenciales: ISequenceProvider = {
    next: (establecimiento, puntoEmision, tipo) =>
      siguienteSecuencial(emisorId, establecimiento, puntoEmision, tipo),
  };

  const fe = new FacturacionElectronicaEC({
    emisor: {
      ruc: emisor.ruc,
      razonSocial: emisor.razonSocial,
      ...(emisor.nombreComercial
        ? { nombreComercial: emisor.nombreComercial }
        : {}),
      dirMatriz: emisor.dirMatriz,
      establecimiento: emisor.establecimiento,
      puntoEmision: emisor.puntoEmision,
      direccionEstablecimiento: emisor.direccionEstablecimiento,
      ...(emisor.contribuyenteEspecial
        ? { contribuyenteEspecial: emisor.contribuyenteEspecial }
        : {}),
      obligadoContabilidad: emisor.obligadoContabilidad,
      ...(emisor.agenteRetencion
        ? { agenteRetencion: emisor.agenteRetencion }
        : {}),
      ambiente: emisor.ambiente === "PRODUCCION" ? "2" : "1",
    },
    p12,
    p12Password: password,
    sequenceProvider: secuenciales,
    // Valida contra los XSD oficiales antes de mandar nada. Es una red de
    // seguridad, no un reemplazo: el SRI valida igual del otro lado.
    validateXsd: true,
  });

  return { fe, emisor };
}

export interface ResultadoEmision {
  estado: string;
  claveAcceso: string;
  secuencial: string;
  numeroAutorizacion: string | null;
  fechaAutorizacion: Date | null;
  xmlFirmado: string;
  mensajes: { identificador?: string; mensaje?: string; informacionAdicional?: string; tipo?: string }[];
  ambiente: "PRUEBAS" | "PRODUCCION";
}

/**
 * Emite una factura: arma, firma, manda y consulta autorización.
 *
 * Devuelve el resultado tal cual, **incluso cuando el SRI la rechaza**: el
 * motivo viene en `mensajes` y es lo único que dice qué arreglar. Tirar una
 * excepción perdería el número de la clave de acceso, que ya se consumió.
 */
export async function emitirFacturaSri(
  emisorId: string,
  datos: DatosFactura
): Promise<ResultadoEmision> {
  const { fe, emisor } = await clienteDelEmisor(emisorId);
  const r = await fe.emitirFactura(datos as never);
  return {
    estado: r.estado,
    claveAcceso: r.claveAcceso,
    secuencial: r.secuencial,
    numeroAutorizacion: r.numeroAutorizacion,
    fechaAutorizacion: r.fechaAutorizacion,
    xmlFirmado: r.xmlFirmado,
    mensajes: r.mensajes ?? [],
    ambiente: emisor.ambiente,
  };
}

/**
 * Arma y firma el comprobante **sin mandarlo**.
 *
 * Sirve para dos cosas. Para ver el XML que va a salir antes de emitir, que en
 * un documento tributario no es un lujo. Y para poder probar toda la cadena
 * —mapeo, validación contra el XSD, firma— sin gastar un número de la serie ni
 * depender de que el SRI esté disponible.
 */
export async function previsualizarFactura(
  emisorId: string,
  datos: DatosFactura,
  secuencial = "000000000"
): Promise<{ xml: string; firmado: string; claveAcceso: string }> {
  const { fe, emisor } = await clienteDelEmisor(emisorId);
  // Con clave de acceso de verdad y no la de relleno: es lo que hace que la
  // previsualización sea el documento que va a salir, y no uno parecido.
  const claveAcceso = generateClaveAcceso({
    fechaEmision: datos.fechaEmision,
    tipoComprobante: "01", // 01 = factura
    ruc: emisor.ruc,
    ambiente: emisor.ambiente === "PRODUCCION" ? "2" : "1",
    establecimiento: emisor.establecimiento,
    puntoEmision: emisor.puntoEmision,
    secuencial,
    codigoNumerico: generateCodigoNumerico(),
    tipoEmision: "1", // 1 = emisión normal
  });
  const xml = fe.buildXml("FACTURA", datos as never, { secuencial, claveAcceso });
  return { xml, firmado: await fe.signXml(xml, "FACTURA"), claveAcceso };
}

/**
 * Vuelve a preguntar por un comprobante ya enviado.
 *
 * Hace falta porque el SRI puede recibir y autorizar en dos momentos: por norma
 * tiene hasta 24 horas. Lo que quedó `ENVIADO` se resuelve preguntando, igual
 * que hoy hace el cron con Contífico.
 */
export async function consultarAutorizacion(
  emisorId: string,
  claveAcceso: string
) {
  const { fe } = await clienteDelEmisor(emisorId);
  return fe.checkAuthorization(claveAcceso);
}

/**
 * El número impreso, a partir de la serie y el secuencial.
 *
 * Es el mismo formato de siempre —`001-002-000000141`— pero ahora lo arma el
 * portal, que es quien lleva la numeración.
 */
export const numeroComprobante = (
  establecimiento: string,
  puntoEmision: string,
  secuencial: string
) => `${establecimiento}-${puntoEmision}-${secuencial}`;

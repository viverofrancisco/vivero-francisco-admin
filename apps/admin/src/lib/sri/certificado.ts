/**
 * Lo que se puede saber de un `.p12` sin llegar a firmar.
 *
 * Sirve para dos cosas al cargarlo: **verificar la contraseña ahí mismo** —si
 * está mal, se avisa al subirlo y no al emitir la primera factura— y quedarse
 * con a nombre de quién está y hasta cuándo sirve. Un certificado vencido deja
 * a ese RUC sin poder facturar, así que la fecha hay que tenerla a mano para
 * avisar antes y no el día que se cae.
 */
import forge from "node-forge";

export interface DatosCertificado {
  /// A nombre de quién está, tal como lo dice el certificado.
  sujeto: string;
  /// Quién lo emitió (Security Data, UANATACA, BCE, ANF…).
  emisor: string;
  vence: Date;
  desde: Date;
}

export function leerCertificado(
  p12: Buffer,
  password: string
): DatosCertificado {
  let asn1;
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary")));
  } catch {
    throw new Error("El archivo no parece un certificado .p12 válido.");
  }

  let almacen;
  try {
    almacen = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    // La librería no distingue "contraseña mala" de "archivo roto", pero en la
    // práctica lo primero es lo que pasa siempre.
    throw new Error("La contraseña del certificado no es correcta.");
  }

  const bolsas = almacen.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  const cert = bolsas?.find((b) => b.cert)?.cert;
  if (!cert) {
    throw new Error("El certificado no trae ningún certificado adentro.");
  }

  const nombre = (campos: forge.pki.Certificate["subject"]): string =>
    campos.attributes
      .filter((a) => a.shortName === "CN" || a.shortName === "O")
      .map((a) => String(a.value))
      .join(" · ") || "—";

  return {
    sujeto: nombre(cert.subject),
    emisor: nombre(cert.issuer),
    desde: cert.validity.notBefore,
    vence: cert.validity.notAfter,
  };
}

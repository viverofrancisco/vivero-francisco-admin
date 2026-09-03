/**
 * El RIDE: la representación impresa del comprobante electrónico.
 *
 * El documento legal es el XML autorizado; esto es el papel que se le entrega
 * al cliente. La ficha técnica del SRI fija **qué datos** van sí o sí —la clave
 * de acceso y su código de barras, el número de autorización con su fecha, el
 * ambiente, los datos del emisor y del comprador, el detalle, las formas de
 * pago y los totales por tarifa— pero **no fija el diseño**, que es del emisor.
 * Por eso el RIDE de cada sistema se ve distinto y todos son válidos.
 *
 * La jerarquía acá busca lo que la gente busca cuando abre una factura: quién
 * la emite, a quién, cuánto, y por qué concepto. El bloque tributario —clave de
 * acceso, autorización, ambiente— es obligatorio pero no es lo que se lee
 * primero, así que va con el peso visual que le corresponde.
 *
 * **El ambiente de pruebas se grita.** Un RIDE de pruebas es idéntico a uno
 * real salvo por ese dato, y confundirlos es entregarle al cliente un papel que
 * no vale.
 */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  pdf,
} from "@react-pdf/renderer";
import { toBuffer as codigoDeBarras } from "bwip-js/node";
import { FORMAS_PAGO_SRI } from "./comprobante";
import type { LogoEmpresa } from "./logo";

const VERDE = "#226633";
const TINTA = "#1a1a1a";
const GRIS = "#666666";
const LINEA = "#e2e2e2";
const FONDO = "#f7f7f5";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 34,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: TINTA,
    lineHeight: 1.4,
  },
  fila: { flexDirection: "row" },

  // ── Encabezado ────────────────────────────────────────────────────────
  encabezado: { flexDirection: "row", marginBottom: 14 },
  logo: { height: 42, width: 120, objectFit: "contain", marginBottom: 8 },
  emisorNombre: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    lineHeight: 1.2,
    color: VERDE,
    marginBottom: 5,
  },
  emisorRazon: { fontSize: 8.5, color: GRIS, marginBottom: 5, marginTop: -3 },

  // El recuadro del documento: lo que el SRI exige, junto y a la derecha.
  documento: {
    // 280 no es un número al azar: en Helvetica un dígito mide 0,556 em, así
    // que los 49 de la clave a 8,5pt ocupan ~232pt y entran en los 260 útiles
    // que deja este ancho. Más angosto y hay que achicar la letra, que es
    // justo lo que no queremos en un número que alguien va a tipear.
    width: 280,
    borderWidth: 1,
    borderColor: LINEA,
    borderRadius: 4,
    padding: 10,
  },
  tipoDoc: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  numeroDoc: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: VERDE,
    marginBottom: 6,
  },

  etiqueta: { color: GRIS },
  dato: { marginBottom: 1 },
  barras: { height: 30, marginTop: 5, objectFit: "contain" },
  clave: { fontSize: 8.5, color: GRIS, marginTop: 3 },
  numeroLargo: { fontSize: 8.5, marginBottom: 4 },

  aviso: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: "#b45309",
    borderRadius: 3,
    color: "#b45309",
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    fontSize: 8,
  },

  // ── Cliente ───────────────────────────────────────────────────────────
  cliente: {
    backgroundColor: FONDO,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  clienteNombre: { fontFamily: "Helvetica-Bold", fontSize: 10 },

  // ── Detalle ───────────────────────────────────────────────────────────
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: GRIS,
    letterSpacing: 0.3,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: TINTA,
  },
  td: {
    fontSize: 8.5,
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
  },

  // ── Pie ───────────────────────────────────────────────────────────────
  caja: {
    borderWidth: 1,
    borderColor: LINEA,
    borderRadius: 4,
    padding: 9,
  },
  subtitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: GRIS,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  totalFila: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 1.5 },
  totalEtiqueta: { width: 140, textAlign: "right", color: GRIS, fontSize: 8 },
  totalValor: { width: 70, textAlign: "right", fontSize: 8.5 },
  granTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: TINTA,
  },
  granTotalEtiqueta: {
    width: 140,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  granTotalValor: {
    width: 70,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: VERDE,
  },
  pie: {
    position: "absolute",
    bottom: 18,
    left: 34,
    right: 34,
    textAlign: "center",
    fontSize: 6.5,
    color: GRIS,
  },
});

export interface RideEmisor {
  razonSocial: string;
  nombreComercial: string | null;
  ruc: string;
  dirMatriz: string;
  direccionEstablecimiento: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string | null;
  agenteRetencion: string | null;
  ambiente: "PRUEBAS" | "PRODUCCION";
}

export interface RideDatos {
  emisor: RideEmisor;
  /** Qué comprobante es. Cambia el título y, en la nota, qué documento corrige. */
  tipo: "FACTURA" | "NOTA_CREDITO";
  /** Solo en la nota de crédito: a qué factura se refiere y por qué. */
  modifica?: { numero: string; fecha: Date; motivo: string } | null;
  numero: string;
  claveAcceso: string;
  numeroAutorizacion: string | null;
  fechaAutorizacion: Date | null;
  fechaEmision: Date;
  comprador: {
    razonSocial: string;
    identificacion: string;
    direccion: string | null;
  };
  lineas: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    /** **Sin impuestos**: es lo que imprime esa columna del RIDE. */
    totalSinImpuestos: number;
  }[];
  /** Cómo se declaró el pago al emitir. El RIDE lo imprime. */
  pagos: { formaPago: string; total: number }[];
  totalDescuento: number;
  propina: number;
  subtotal0: number;
  subtotalGravado: number;
  iva: number;
  total: number;
  /** Lo que va en *Información adicional*. */
  logo?: LogoEmpresa | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;

const fechaLarga = (d: Date) =>
  d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

const fechaHora = (d: Date) =>
  `${d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Guayaquil" })} ${d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Guayaquil" })}`;

export async function renderRide(datos: RideDatos): Promise<Buffer> {
  // El código de barras de la clave de acceso: lo pide la ficha técnica y es
  // por donde se verifica el comprobante sin tipear 49 dígitos.
  const barras = await codigoDeBarras({
    bcid: "code128",
    text: datos.claveAcceso,
    scale: 3,
    height: 9,
    includetext: false,
  });

  const stream = await pdf(
    <RideDocument datos={datos} barras={barras} />
  ).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function Dato({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <Text style={styles.dato}>
      <Text style={styles.etiqueta}>{etiqueta}: </Text>
      <Text style={fuerte ? { fontFamily: "Helvetica-Bold" } : undefined}>
        {valor}
      </Text>
    </Text>
  );
}

function RideDocument({
  datos,
  barras,
}: {
  datos: RideDatos;
  barras: Buffer;
}) {
  const { emisor } = datos;
  const esNota = datos.tipo === "NOTA_CREDITO";

  return (
    <Document
      title={`${esNota ? "Nota de crédito" : "Factura"} ${datos.numero}`}
      author={emisor.razonSocial}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          {/* Quién emite. El logo manda, y debajo lo que el SRI exige. */}
          <View style={{ flex: 1, paddingRight: 16 }}>
            {datos.logo && (
              // El `Image` de @react-pdf no es el del navegador y no acepta
              // `alt`; la regla lo confunde con un `<img>`.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                style={styles.logo}
                src={{ data: Buffer.from(datos.logo.bytes), format: datos.logo.format }}
              />
            )}
            <Text style={styles.emisorNombre}>
              {emisor.nombreComercial || emisor.razonSocial}
            </Text>
            {emisor.nombreComercial &&
              emisor.nombreComercial !== emisor.razonSocial && (
                <Text style={styles.emisorRazon}>{emisor.razonSocial}</Text>
              )}
            <Dato etiqueta="RUC" valor={emisor.ruc} fuerte />
            <Dato etiqueta="Dirección matriz" valor={emisor.dirMatriz} />
            {emisor.direccionEstablecimiento !== emisor.dirMatriz && (
              <Dato
                etiqueta="Dirección sucursal"
                valor={emisor.direccionEstablecimiento}
              />
            )}
            <Dato
              etiqueta="Obligado a llevar contabilidad"
              valor={emisor.obligadoContabilidad ? "SÍ" : "NO"}
            />
            {emisor.contribuyenteEspecial && (
              <Dato
                etiqueta="Contribuyente especial"
                valor={emisor.contribuyenteEspecial}
              />
            )}
            {emisor.agenteRetencion && (
              <Dato etiqueta="Agente de retención" valor={emisor.agenteRetencion} />
            )}
          </View>

          {/* Qué documento es: el bloque tributario, obligatorio y agrupado. */}
          <View style={styles.documento}>
            <Text style={styles.tipoDoc}>
              {esNota ? "NOTA DE CRÉDITO" : "FACTURA"}
            </Text>
            <Text style={styles.numeroDoc}>{datos.numero}</Text>
            {/* En su propio renglón, no por tamaño sino por ancho: 49
                dígitos sin espacios no tienen dónde cortarse —probado, ni
                siquiera con un espacio de ancho cero— así que al lado de la
                etiqueta no entraban. Solos sí, y al tamaño del resto. */}
            <Text style={styles.etiqueta}>Autorización</Text>
            <Text style={styles.numeroLargo}>
              {datos.numeroAutorizacion ?? datos.claveAcceso}
            </Text>
            <Dato
              etiqueta="Fecha y hora"
              valor={
                datos.fechaAutorizacion
                  ? fechaHora(datos.fechaAutorizacion)
                  : "Pendiente de autorización"
              }
            />
            <Dato
              etiqueta="Ambiente"
              valor={emisor.ambiente === "PRODUCCION" ? "PRODUCCIÓN" : "PRUEBAS"}
            />
            <Dato etiqueta="Emisión" valor="NORMAL" />
            <Text style={[styles.etiqueta, { marginTop: 4 }]}>
              Clave de acceso
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el `Image` de
                @react-pdf no es el del navegador y no acepta `alt`. */}
            <Image style={styles.barras} src={{ data: barras, format: "png" }} />
            <Text style={styles.clave}>{datos.claveAcceso}</Text>
            {emisor.ambiente === "PRUEBAS" && (
              <Text style={styles.aviso}>
                AMBIENTE DE PRUEBAS{"\n"}SIN VALIDEZ TRIBUTARIA
              </Text>
            )}
          </View>
        </View>

        {/* Qué corrige la nota. Sin esto el papel no dice a qué se refiere. */}
        {datos.modifica && (
          <View style={[styles.caja, { marginBottom: 12 }]}>
            <Text style={styles.subtitulo}>DOCUMENTO QUE MODIFICA</Text>
            <View style={styles.fila}>
              <View style={{ flex: 1 }}>
                <Dato
                  etiqueta="Comprobante"
                  valor={`Factura ${datos.modifica.numero}`}
                  fuerte
                />
                <Dato
                  etiqueta="Fecha de emisión"
                  valor={fechaLarga(datos.modifica.fecha)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Dato etiqueta="Motivo" valor={datos.modifica.motivo} />
              </View>
            </View>
          </View>
        )}

        {/* A quién se le factura */}
        <View style={styles.cliente}>
          <View style={styles.fila}>
            <View style={{ flex: 2, paddingRight: 12 }}>
              <Text style={styles.clienteNombre}>
                {datos.comprador.razonSocial}
              </Text>
              <Dato
                etiqueta="Identificación"
                valor={datos.comprador.identificacion}
              />
              {datos.comprador.direccion && (
                <Dato etiqueta="Dirección" valor={datos.comprador.direccion} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Dato
                etiqueta="Fecha de emisión"
                valor={fechaLarga(datos.fechaEmision)}
              />
            </View>
          </View>
        </View>

        {/* El detalle */}
        <View>
          {/* `fixed`: con muchos ítems la tabla sigue en la página siguiente
              y sin esto las columnas quedaban sin encabezado. */}
          <View style={styles.fila} fixed>
            <Text style={[styles.th, { width: 78 }]}>CÓDIGO</Text>
            <Text style={[styles.th, { flex: 1 }]}>DESCRIPCIÓN</Text>
            <Text style={[styles.th, { width: 42, textAlign: "right" }]}>CANT.</Text>
            <Text style={[styles.th, { width: 62, textAlign: "right" }]}>P. UNIT.</Text>
            <Text style={[styles.th, { width: 55, textAlign: "right" }]}>DESC.</Text>
            <Text style={[styles.th, { width: 68, textAlign: "right" }]}>TOTAL</Text>
          </View>
          {datos.lineas.map((l, i) => (
            <View style={styles.fila} key={i} wrap={false}>
              <Text style={[styles.td, { width: 78, color: GRIS, fontSize: 7.5 }]}>
                {l.codigo}
              </Text>
              <Text style={[styles.td, { flex: 1 }]}>{l.descripcion}</Text>
              <Text style={[styles.td, { width: 42, textAlign: "right" }]}>
                {l.cantidad}
              </Text>
              <Text style={[styles.td, { width: 62, textAlign: "right" }]}>
                {money(l.precioUnitario)}
              </Text>
              <Text style={[styles.td, { width: 55, textAlign: "right" }]}>
                {money(l.descuento)}
              </Text>
              <Text
                style={[
                  styles.td,
                  { width: 68, textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {money(l.totalSinImpuestos)}
              </Text>
            </View>
          ))}
        </View>

        {/* `wrap={false}`: los totales se leen juntos o no se leen. Partirlos
            entre dos páginas deja media cuenta en cada una. */}
        <View style={[styles.fila, { marginTop: 12 }]} wrap={false}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={styles.caja}>
              <Text style={styles.subtitulo}>FORMA DE PAGO</Text>
              {datos.pagos.map((p, i) => (
                <View
                  key={i}
                  style={[styles.fila, { justifyContent: "space-between" }]}
                >
                  <Text style={{ flex: 1 }}>
                    {FORMAS_PAGO_SRI[p.formaPago] ?? `Forma ${p.formaPago}`}
                  </Text>
                  <Text style={{ width: 62, textAlign: "right" }}>
                    {money(p.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Totales, con las bases separadas por tarifa: sumarlas juntas
              cerraría el total y mentiría el desglose del IVA. */}
          <View style={{ width: 220 }}>
            {datos.subtotalGravado > 0 && (
              <View style={styles.totalFila}>
                <Text style={styles.totalEtiqueta}>SUBTOTAL 15%</Text>
                <Text style={styles.totalValor}>{money(datos.subtotalGravado)}</Text>
              </View>
            )}
            {datos.subtotal0 > 0 && (
              <View style={styles.totalFila}>
                <Text style={styles.totalEtiqueta}>SUBTOTAL 0%</Text>
                <Text style={styles.totalValor}>{money(datos.subtotal0)}</Text>
              </View>
            )}
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>SUBTOTAL SIN IMPUESTOS</Text>
              <Text style={styles.totalValor}>
                {money(datos.subtotal0 + datos.subtotalGravado)}
              </Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>TOTAL DESCUENTO</Text>
              <Text style={styles.totalValor}>{money(datos.totalDescuento)}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>IVA</Text>
              <Text style={styles.totalValor}>{money(datos.iva)}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>PROPINA</Text>
              <Text style={styles.totalValor}>{money(datos.propina)}</Text>
            </View>
            <View style={styles.granTotal}>
              <Text style={styles.granTotalEtiqueta}>VALOR TOTAL</Text>
              <Text style={styles.granTotalValor}>{money(datos.total)}</Text>
            </View>
          </View>
        </View>

        {/* El pie recuerda qué es esto, que es lo que más se malentiende. */}
        <View style={styles.pie} fixed>
          <Text>
            Representación impresa del comprobante electrónico. El documento
            autorizado es el archivo XML.
          </Text>
          {/* Solo cuando hay más de una: en la única hoja, "Página 1 de 1" es
              ruido. */}
          <Text
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : ""
            }
          />
        </View>
      </Page>
    </Document>
  );
}

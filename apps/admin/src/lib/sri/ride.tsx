/**
 * El RIDE: la representación impresa del comprobante electrónico.
 *
 * El documento legal es el XML autorizado; esto es el papel que se le entrega
 * al cliente y tiene que decir lo mismo. La ficha técnica del SRI fija qué
 * datos van sí o sí —la clave de acceso y su código de barras, el número de
 * autorización con su fecha, el ambiente, los datos del emisor y del
 * comprador, el detalle y los totales por tarifa—, así que la plantilla no es
 * una decisión de diseño: es una lista de requisitos.
 *
 * **El ambiente se imprime bien grande cuando es de pruebas.** Un RIDE de
 * pruebas es idéntico a uno real salvo por ese dato, y confundirlos es
 * entregarle al cliente un papel que no vale.
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

const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#555555";
const COLOR_LINEA = "#cccccc";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR_TEXT,
  },
  fila: { flexDirection: "row" },
  caja: {
    borderWidth: 1,
    borderColor: COLOR_LINEA,
    borderRadius: 3,
    padding: 8,
  },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 4 },
  subtitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginBottom: 3,
  },
  etiqueta: { color: COLOR_MUTED },
  dato: { marginBottom: 1.5 },
  barras: { height: 34, marginTop: 4, objectFit: "contain" },
  clave: { fontSize: 7, marginTop: 2, letterSpacing: 0.4 },
  aviso: {
    marginTop: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: "#b45309",
    color: "#b45309",
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    fontSize: 9,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_TEXT,
  },
  td: {
    fontSize: 7.5,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_LINEA,
  },
  totalFila: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  totalEtiqueta: { width: 130, textAlign: "right", color: COLOR_MUTED },
  totalValor: { width: 70, textAlign: "right" },
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
    total: number;
  }[];
  subtotal0: number;
  subtotalGravado: number;
  iva: number;
  total: number;
  /** Lo que va en *Información adicional*. */
  descripcion: string | null;
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
    height: 10,
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

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Text style={styles.dato}>
      <Text style={styles.etiqueta}>{etiqueta}: </Text>
      {valor}
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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.fila}>
          {/* Quién emite */}
          <View style={[styles.caja, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.titulo}>
              {emisor.nombreComercial || emisor.razonSocial}
            </Text>
            {emisor.nombreComercial && (
              <Dato etiqueta="Razón social" valor={emisor.razonSocial} />
            )}
            <Dato etiqueta="Dirección matriz" valor={emisor.dirMatriz} />
            <Dato
              etiqueta="Dirección sucursal"
              valor={emisor.direccionEstablecimiento}
            />
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
              <Dato
                etiqueta="Agente de retención"
                valor={emisor.agenteRetencion}
              />
            )}
          </View>

          {/* Qué documento es */}
          <View style={[styles.caja, { flex: 1 }]}>
            <Dato etiqueta="R.U.C." valor={emisor.ruc} />
            <Text style={styles.titulo}>FACTURA</Text>
            <Dato etiqueta="No." valor={datos.numero} />
            <Dato
              etiqueta="Número de autorización"
              valor={datos.numeroAutorizacion ?? datos.claveAcceso}
            />
            <Dato
              etiqueta="Fecha y hora de autorización"
              valor={
                datos.fechaAutorizacion
                  ? fechaHora(datos.fechaAutorizacion)
                  : "Pendiente"
              }
            />
            <Dato
              etiqueta="Ambiente"
              valor={emisor.ambiente === "PRODUCCION" ? "PRODUCCIÓN" : "PRUEBAS"}
            />
            <Dato etiqueta="Emisión" valor="NORMAL" />
            <Text style={styles.etiqueta}>Clave de acceso</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- el `Image` de
                @react-pdf no es el del navegador y no acepta `alt`; la regla lo
                confunde con un `<img>`. La clave va escrita abajo igual. */}
            <Image style={styles.barras} src={{ data: barras, format: "png" }} />
            <Text style={styles.clave}>{datos.claveAcceso}</Text>
            {/* Un RIDE de pruebas es igual a uno real salvo por esto. */}
            {emisor.ambiente === "PRUEBAS" && (
              <Text style={styles.aviso}>
                DOCUMENTO EMITIDO EN AMBIENTE DE PRUEBAS · SIN VALIDEZ
                TRIBUTARIA
              </Text>
            )}
          </View>
        </View>

        {/* A quién se le factura */}
        <View style={[styles.caja, { marginTop: 8 }]}>
          <View style={styles.fila}>
            <View style={{ flex: 2 }}>
              <Dato
                etiqueta="Razón social / Nombres y apellidos"
                valor={datos.comprador.razonSocial}
              />
              <Dato
                etiqueta="Identificación"
                valor={datos.comprador.identificacion}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Dato
                etiqueta="Fecha de emisión"
                valor={fechaLarga(datos.fechaEmision)}
              />
              {datos.comprador.direccion && (
                <Dato etiqueta="Dirección" valor={datos.comprador.direccion} />
              )}
            </View>
          </View>
        </View>

        {/* El detalle */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.fila}>
            <Text style={[styles.th, { width: 70 }]}>Cód.</Text>
            <Text style={[styles.th, { flex: 1 }]}>Descripción</Text>
            <Text style={[styles.th, { width: 40, textAlign: "right" }]}>Cant.</Text>
            <Text style={[styles.th, { width: 60, textAlign: "right" }]}>P. unit.</Text>
            <Text style={[styles.th, { width: 55, textAlign: "right" }]}>Desc.</Text>
            <Text style={[styles.th, { width: 65, textAlign: "right" }]}>Total</Text>
          </View>
          {datos.lineas.map((l, i) => (
            <View style={styles.fila} key={i}>
              <Text style={[styles.td, { width: 70 }]}>{l.codigo}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{l.descripcion}</Text>
              <Text style={[styles.td, { width: 40, textAlign: "right" }]}>
                {l.cantidad}
              </Text>
              <Text style={[styles.td, { width: 60, textAlign: "right" }]}>
                {money(l.precioUnitario)}
              </Text>
              <Text style={[styles.td, { width: 55, textAlign: "right" }]}>
                {money(l.descuento)}
              </Text>
              <Text style={[styles.td, { width: 65, textAlign: "right" }]}>
                {money(l.total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.fila, { marginTop: 10 }]}>
          {/* Información adicional */}
          <View style={[styles.caja, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.subtitulo}>Información adicional</Text>
            {datos.descripcion ? (
              <Text>{datos.descripcion}</Text>
            ) : (
              <Text style={styles.etiqueta}>—</Text>
            )}
          </View>

          {/* Totales, con las bases separadas por tarifa */}
          <View style={{ width: 210 }}>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>SUBTOTAL 15%</Text>
              <Text style={styles.totalValor}>{money(datos.subtotalGravado)}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>SUBTOTAL 0%</Text>
              <Text style={styles.totalValor}>{money(datos.subtotal0)}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>SUBTOTAL SIN IMPUESTOS</Text>
              <Text style={styles.totalValor}>
                {money(datos.subtotal0 + datos.subtotalGravado)}
              </Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>IVA</Text>
              <Text style={styles.totalValor}>{money(datos.iva)}</Text>
            </View>
            <View style={styles.totalFila}>
              <Text style={[styles.totalEtiqueta, { fontFamily: "Helvetica-Bold", color: COLOR_TEXT }]}>
                VALOR TOTAL
              </Text>
              <Text style={[styles.totalValor, { fontFamily: "Helvetica-Bold" }]}>
                {money(datos.total)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

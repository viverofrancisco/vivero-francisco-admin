import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type {
  InformeRenderData,
  InformeRenderFirmante,
  InformeRenderSeccion,
} from "./template-data";

// Use built-in Helvetica family. Loading custom fonts at runtime in
// serverless environments is fragile and not worth it for v1.

const COLOR_GREEN = "#226633";
const COLOR_BLUE = "#1a4178";
const COLOR_TEXT = "#222222";
const COLOR_MUTED = "#555555";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLOR_TEXT,
    backgroundColor: "#fafafa",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 18,
  },
  logo: {
    height: 36,
    width: 110,
    objectFit: "contain",
  },
  topBarSpacer: {
    height: 36,
  },
  titleBlock: {
    marginBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-BoldOblique",
    color: COLOR_GREEN,
    textDecoration: "underline",
    textAlign: "center",
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLOR_BLUE,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 1.3,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLOR_GREEN,
    textDecoration: "underline",
    textAlign: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 10,
    lineHeight: 1.45,
    textAlign: "justify",
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  photo: {
    width: "32%",
    height: 130,
    objectFit: "cover",
    borderWidth: 0.5,
    borderColor: "#bbbbbb",
  },
  watermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.06,
  },
  watermarkImage: {
    width: "65%",
    objectFit: "contain",
  },
  signaturesBlock: {
    marginTop: 36,
  },
  signaturesIntro: {
    fontFamily: "Helvetica-BoldOblique",
    fontSize: 12,
    color: COLOR_TEXT,
  },
  signaturesRow: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "flex-start",
    flexWrap: "wrap",
  },
  signatureCell: {
    width: 180,
    marginRight: 32,
    alignItems: "flex-start",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: COLOR_TEXT,
    width: "100%",
    marginBottom: 4,
  },
  signatureName: {
    fontFamily: "Helvetica-BoldOblique",
    fontSize: 11,
    textAlign: "left",
  },
  signatureCedula: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    textAlign: "left",
    color: COLOR_MUTED,
  },
});

export async function renderInformePDF(
  data: InformeRenderData
): Promise<Buffer> {
  // `.toBuffer()` returns a Node Readable stream. Drain it to a Buffer.
  const stream = await pdf(<InformeDocument data={data} />).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function InformeDocument({ data }: { data: InformeRenderData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {data.logo ? (
          <View style={styles.watermark} fixed>
            <Image
              style={styles.watermarkImage}
              src={{
                data: Buffer.from(data.logo.bytes),
                format: data.logo.format,
              }}
            />
          </View>
        ) : null}
        <View style={styles.topBar} fixed>
          {data.logo ? (
            <Image
              style={styles.logo}
              src={{
                data: Buffer.from(data.logo.bytes),
                format: data.logo.format,
              }}
            />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
          <Text>Samborondón, {formatLongDate(data.fecha)}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{data.titulo}</Text>
          <Text style={styles.subtitle}>{data.subtitulo}</Text>
        </View>

        {data.secciones.map((seccion, i) => (
          <Section key={i} seccion={seccion} />
        ))}

        <SignaturesBlock data={data} />
      </Page>
    </Document>
  );
}

function Section({ seccion }: { seccion: InformeRenderSeccion }) {
  return (
    <View wrap>
      <Text style={styles.sectionTitle}>{seccion.titulo.toUpperCase()}</Text>
      {seccion.descripcion ? (
        <Text style={styles.sectionDescription}>{seccion.descripcion}</Text>
      ) : null}
      {seccion.fotos.length > 0 ? (
        <View style={styles.photoRow}>
          {seccion.fotos.map((foto) => (
            <Image
              key={foto.id}
              style={styles.photo}
              src={{
                data: Buffer.from(foto.bytes),
                format: foto.mimeType.includes("png") ? "png" : "jpg",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SignaturesBlock({ data }: { data: InformeRenderData }) {
  if (data.firmantes.length === 0) return null;
  return (
    <View style={styles.signaturesBlock} wrap={false}>
      <Text style={styles.signaturesIntro}>Atentamente,</Text>
      <View style={styles.signaturesRow}>
        {data.firmantes.map((f, i) => (
          <SignatureCell key={i} firma={f} />
        ))}
      </View>
    </View>
  );
}

function SignatureCell({ firma }: { firma: InformeRenderFirmante }) {
  return (
    <View style={styles.signatureCell}>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureName}>{firma.nombre}</Text>
      {firma.cedula ? (
        <Text style={styles.signatureCedula}>C.I. {firma.cedula}</Text>
      ) : null}
    </View>
  );
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

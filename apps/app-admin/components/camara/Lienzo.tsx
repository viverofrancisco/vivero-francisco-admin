import { forwardRef, useState } from "react";
import { Image, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  FUENTES,
  coloresDelTexto,
  type FotoEnEdicion,
  type TextoEnFoto,
  type Trazo,
} from "@/lib/edicion-de-fotos";

/** El camino SVG de un trazo, en los puntos de esta caja. */
export function caminoDe(t: Trazo, ancho: number, alto: number): string {
  if (t.puntos.length === 0) return "";
  const [p0, ...resto] = t.puntos;
  const inicio = `M${p0.x * ancho} ${p0.y * alto}`;
  // Un toque sin arrastre es un punto: una línea de largo cero con la punta
  // redonda se dibuja como un círculo.
  if (resto.length === 0) return `${inicio} L${p0.x * ancho + 0.01} ${p0.y * alto}`;
  return `${inicio} ${resto.map((p) => `L${p.x * ancho} ${p.y * alto}`).join(" ")}`;
}

/**
 * La foto con sus trazos y textos, a la medida que se le pida.
 *
 * Es **el mismo componente** en el editor, a lo ancho del teléfono, y al
 * aplanar (`react-native-view-shot`), a la resolución de la foto: todo se
 * guarda en fracciones, así que lo que se ve es lo que sale. Los trazos son
 * SVG; los textos, `Text` de React Native, porque el fondo, la alineación y
 * las letras tienen que salir iguales que en el campo donde se escriben.
 */
export const Lienzo = forwardRef<
  View,
  {
    foto: FotoEnEdicion;
    ancho: number;
    alto: number;
    /** El trazo que se está dibujando, todavía sin soltar. */
    enCurso?: Trazo | null;
    /** El texto que se está escribiendo encima, que no se dibuja dos veces. */
    sinElTexto?: string | null;
    onCargada?: () => void;
  }
>(function Lienzo({ foto, ancho, alto, enCurso, sinElTexto, onCargada }, ref) {
  const trazos = enCurso ? [...foto.trazos, enCurso] : foto.trazos;
  return (
    <View ref={ref} collapsable={false} style={{ width: ancho, height: alto, overflow: "hidden" }}>
      <Image
        source={{ uri: foto.archivo.uri }}
        style={{ width: ancho, height: alto }}
        resizeMode="stretch"
        // Android aparece las imágenes en 300 ms: al aplanar, la captura
        // agarraba la foto a medio aparecer y salía oscura.
        fadeDuration={0}
        onLoadEnd={onCargada}
      />
      <Svg width={ancho} height={alto} style={{ position: "absolute", left: 0, top: 0 }}>
        {trazos.map((t, i) => (
          <Path
            key={i}
            d={caminoDe(t, ancho, alto)}
            stroke={t.color}
            strokeWidth={t.grosor * ancho}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
      {foto.textos
        .filter((t) => t.id !== sinElTexto)
        .map((t) => (
          <TextoEnLienzo key={t.id} t={t} ancho={ancho} alto={alto} />
        ))}
    </View>
  );
});

/** Cómo se ve un texto a una letra de `tamano` puntos: lo comparten el lienzo y el campo. */
export function estiloDelTexto(t: TextoEnFoto, tamano: number) {
  const { letra, fondo } = coloresDelTexto(t);
  return {
    caja: fondo
      ? {
          backgroundColor: fondo,
          borderRadius: tamano * 0.3,
          paddingHorizontal: tamano * 0.35,
          paddingVertical: tamano * 0.12,
        }
      : null,
    letra: {
      ...FUENTES[t.fuente],
      color: letra,
      fontSize: tamano,
      lineHeight: tamano * 1.25,
      textAlign: t.alineacion,
      // Sin fondo, una sombra suave para que se lea sobre el pasto claro.
      ...(fondo
        ? null
        : {
            textShadowColor: "rgba(0,0,0,0.45)",
            textShadowRadius: tamano * 0.08,
            textShadowOffset: { width: 0, height: tamano * 0.02 },
          }),
    },
  };
}

/** Un texto sobre la foto, centrado en su punto. */
function TextoEnLienzo({ t, ancho, alto }: { t: TextoEnFoto; ancho: number; alto: number }) {
  const tamano = t.tamano * ancho;
  const estilo = estiloDelTexto(t, tamano);
  const [medido, setMedido] = useState(0);
  return (
    // Una caja del doble de la foto centrada en el punto: lo de adentro se
    // centra solo, sin medirlo.
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: t.x * ancho - ancho,
        top: t.y * alto - alto,
        width: ancho * 2,
        height: alto * 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Medido aparte y dibujado con ese ancho y un poco más: con letras
          como la manuscrita, Android mide la línea corta y al dibujarla manda
          la última palabra a una línea que no cabe en la caja. */}
      <Text
        allowFontScaling={false}
        style={[estilo.letra, { position: "absolute", opacity: 0, maxWidth: ancho * 0.9 }]}
        onLayout={(e) => setMedido(e.nativeEvent.layout.width)}
      >
        {t.texto}
      </Text>
      <View style={estilo.caja}>
        <Text
          allowFontScaling={false}
          style={[estilo.letra, medido ? { width: medido + tamano * 0.1 } : { maxWidth: ancho * 0.9 }]}
        >
          {t.texto}
        </Text>
      </View>
    </View>
  );
}

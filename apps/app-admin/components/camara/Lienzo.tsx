import { forwardRef } from "react";
import { Image, View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import type { FotoEnEdicion, TextoEnFoto, Trazo } from "@/lib/edicion-de-fotos";

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
 * guarda en fracciones, así que lo que se ve es lo que sale.
 */
export const Lienzo = forwardRef<
  View,
  {
    foto: FotoEnEdicion;
    ancho: number;
    alto: number;
    /** El trazo que se está dibujando, todavía sin soltar. */
    enCurso?: Trazo | null;
    /** Textos que se dibujan aparte (el editor los hace arrastrables). */
    sinTextos?: boolean;
    onCargada?: () => void;
  }
>(function Lienzo({ foto, ancho, alto, enCurso, sinTextos = false, onCargada }, ref) {
  const trazos = enCurso ? [...foto.trazos, enCurso] : foto.trazos;
  return (
    <View ref={ref} collapsable={false} style={{ width: ancho, height: alto }}>
      <Image
        source={{ uri: foto.archivo.uri }}
        style={{ width: ancho, height: alto }}
        resizeMode="stretch"
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
        {sinTextos ? null : foto.textos.map((t) => <TextoSvg key={t.id} t={t} ancho={ancho} alto={alto} />)}
      </Svg>
    </View>
  );
});

/**
 * Un texto sobre la foto: centrado en su punto, con un borde oscuro fino
 * para que se lea sobre el pasto claro y sobre la sombra.
 */
export function TextoSvg({ t, ancho, alto }: { t: TextoEnFoto; ancho: number; alto: number }) {
  const tamano = t.tamano * ancho;
  const lineas = t.texto.split("\n");
  const primera = t.y * alto - ((lineas.length - 1) * tamano * 1.2) / 2 + tamano * 0.35;
  return (
    <>
      {lineas.map((linea, i) => (
        <SvgText
          key={i}
          x={t.x * ancho}
          y={primera + i * tamano * 1.2}
          fontSize={tamano}
          fontWeight="700"
          fill={t.color}
          stroke={t.color === "#000000" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"}
          strokeWidth={Math.max(tamano * 0.03, 0.5)}
          textAnchor="middle"
        >
          {linea}
        </SvgText>
      ))}
    </>
  );
}

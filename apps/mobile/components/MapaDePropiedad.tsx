import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";
import { ActivityIndicator, Text } from "react-native-paper";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * El punto exacto de una propiedad, elegido en un mapa nativo.
 *
 * Es el mapa del portal en el teléfono: Google, satelital con etiquetas, el pin
 * se pone tocando y se arrastra. Google en las dos plataformas a propósito —en
 * iOS existiría Apple Maps sin clave—, porque las fotos satelitales de Apple y
 * de Google no coinciden al metro y un pin puesto sobre una y mirado sobre la
 * otra cae en el vecino: justo el error que el pin viene a quitar. Antes la
 * app solo tomaba el GPS parado en la puerta y el ajuste fino esperaba a una
 * computadora.
 *
 * Las mismas tres reglas del portal: **el mapa va a donde está el pin** cuando
 * lo trae el GPS, se abre sobre él si ya lo tenía, y buscar una dirección lo
 * lleva al barrio **sin poner el pin** —lo que Google contesta por "Blue Bay"
 * es el centro de la urbanización, doscientas casas—. Ponerlo a mano no
 * recentra: el punto ya está donde el dedo lo puso, y moverlo correría la
 * esquina con la que se estaba apuntando.
 */
export interface Punto {
  lat: number;
  lng: number;
}

/** A dónde llevar el mapa, y con qué zoom. `n` cambia en cada viaje, para
 *  que dos lecturas de GPS en el mismo lugar muevan el mapa las dos veces. */
export interface Destino extends Punto {
  zoom: number;
  n: number;
}

/** Guayaquil. Desde dónde arranca el mapa cuando la propiedad no tiene pin. */
const CENTRO_POR_DEFECTO: Punto = { lat: -2.1709, lng: -79.9224 };
/** Con el que se distingue una casa de la de al lado. */
export const ZOOM_DE_CALLE = 19;
/** Donde deja el mapa una dirección buscada: el barrio, no la puerta. */
export const ZOOM_DE_BARRIO = 16;
const ZOOM_DE_CIUDAD = 12;

/**
 * Cuánto acercar según lo que el teléfono dice que sabe.
 *
 * Una lectura de ±20 m es un GPS y aguanta el zoom de casa; una de ±2 km es la
 * antena de la operadora, y mostrarla de cerca haría creer que el pin está
 * bien puesto.
 */
export function zoomSegunPrecision(metros: number | null): number {
  if (metros === null) return ZOOM_DE_BARRIO;
  if (metros <= 30) return ZOOM_DE_CALLE;
  if (metros <= 150) return 17;
  if (metros <= 1000) return 15;
  return 13;
}

export function MapaDePropiedad({
  punto,
  precision,
  destino,
  ubicando,
  onCambio,
  onUsarMiUbicacion,
}: {
  punto: Punto | null;
  /** Con cuántos metros de error llegó el punto, si lo trajo el GPS. */
  precision: number | null;
  destino: Destino | null;
  ubicando: boolean;
  onCambio: (punto: Punto | null) => void;
  onUsarMiUbicacion: () => void;
}) {
  const mapa = useRef<MapView>(null);

  // Ir a donde el GPS o el buscador dijeron. Poner el pin a mano no pasa por
  // acá: ver arriba.
  useEffect(() => {
    if (!destino) return;
    mapa.current?.animateCamera(
      { center: { latitude: destino.lat, longitude: destino.lng }, zoom: destino.zoom },
      { duration: 600 }
    );
  }, [destino]);

  const inicio = punto ?? CENTRO_POR_DEFECTO;

  return (
    <View style={styles.caja}>
      {/* El responder es del mapa: si no, en Android la lista de arriba se
          queda con el arrastre vertical y el mapa no se mueve. */}
      <View style={styles.mapaCaja} onStartShouldSetResponder={() => true}>
        <MapView
          ref={mapa}
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          mapType="hybrid"
          initialCamera={{
            center: { latitude: inicio.lat, longitude: inicio.lng },
            zoom: punto ? ZOOM_DE_CALLE : ZOOM_DE_CIUDAD,
            pitch: 0,
            heading: 0,
            altitude: punto ? 300 : 40_000,
          }}
          onPress={(e: MapPressEvent) =>
            onCambio({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })
          }
          toolbarEnabled={false}
          showsCompass={false}
          showsMyLocationButton={false}
          pitchEnabled={false}
        >
          {punto ? (
            <Marker
              coordinate={{ latitude: punto.lat, longitude: punto.lng }}
              draggable
              onDragEnd={(e: MarkerDragStartEndEvent) =>
                onCambio({
                  lat: e.nativeEvent.coordinate.latitude,
                  lng: e.nativeEvent.coordinate.longitude,
                })
              }
            />
          ) : null}
        </MapView>
      </View>

      {punto ? (
        <>
          <Text style={styles.coordenadas}>
            {punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}
          </Text>
          {precision !== null ? (
            <Text style={[styles.ayuda, precision > 150 ? styles.ayudaAtencion : null]}>
              {precision > 150
                ? `Llegó con ±${Math.round(precision)} m: ajústalo tocando el mapa.`
                : `±${Math.round(precision)} m`}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.ayuda}>
          Toca el mapa para poner el pin en la entrada de la casa, o toma tu
          ubicación si estás parado ahí.
        </Text>
      )}

      <View style={styles.botones}>
        <PressableScale
          onPress={onUsarMiUbicacion}
          disabled={ubicando}
          estiloExterno={styles.crece}
          style={styles.botonSuave}
        >
          {ubicando ? (
            <ActivityIndicator size="small" color={tema.verde} />
          ) : (
            <Text style={styles.botonSuaveTexto}>
              Usar mi ubicación
            </Text>
          )}
        </PressableScale>
        {punto ? (
          <PressableScale onPress={() => onCambio(null)} style={styles.botonSuave}>
            <Text style={styles.botonSuaveTexto}>Quitar</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  mapaCaja: {
    height: 300,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: tema.linea2,
  },
  mapa: { flex: 1 },
  coordenadas: {
    color: tema.texto,
    fontVariant: ["tabular-nums"],
    fontSize: 15,
    paddingHorizontal: 4,
  },
  ayuda: { color: tema.texto3, fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
  ayudaAtencion: { color: tema.ambarTexto },
  botones: { flexDirection: "row", gap: 8 },
  crece: { flex: 1 },
  botonSuave: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: tema.verde50,
  },
  botonSuaveTexto: { color: tema.verde700, fontWeight: "600", fontSize: 15 },
});

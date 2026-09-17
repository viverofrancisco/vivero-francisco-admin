import { useState } from "react";
import { Image, Linking, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  direccionDePropiedad,
  enlaceParaLlegar,
  zonaDePropiedad,
  type PropiedadMostrable,
} from "@vivero/shared";
import { PressableScale } from "@/components/ui/PressableScale";
import { API_BASE_URL } from "@/lib/config";
import { useAuthStore } from "@/lib/auth-store";
import { tema } from "@/lib/tema";

/**
 * Dónde queda la propiedad de esta visita, y cómo llegar.
 *
 * **Arriba va la estampa de Google Maps**, que la pide nuestro servidor
 * (`/api/mobile/mapa`) y no la app: la clave se restringe por dominio y una app
 * nativa no tiene dominio que mandar, así que una clave puesta acá adentro
 * estaría sin proteger y encima viajaría en el bundle. Es una imagen y no un
 * mapa navegable a propósito: lo que hace falta en esta pantalla es reconocer
 * la manzana de un vistazo y salir a manejar —eso lo hace *Llegar*—, no
 * explorar con el pulgar. Un mapa interactivo sería `react-native-maps`: módulo
 * nativo, otra clave para Android y reconstruir la app, para una postal de
 * 150 px.
 *
 * Si el servidor no tiene su clave, o no hay señal, queda el panel de franjas
 * dibujado acá mismo. La tarjeta sigue sirviendo: lo único que falta es la
 * foto.
 *
 * Por coordenadas y no por dirección escrita: "Blue Bay" son doscientas casas,
 * y el pin existe justamente para no depender de eso.
 */
export function UbicacionPropiedad({
  propiedad,
}: {
  propiedad: PropiedadMostrable;
}) {
  const { lat, lng } = propiedad;
  const tienePunto = lat !== null && lat !== undefined && lng !== null && lng !== undefined;
  const direccion = direccionDePropiedad(propiedad);
  const zona = zonaDePropiedad(propiedad);

  // Sin punto y sin dirección no hay nada que decir; la tarjeta sería un
  // rectángulo vacío con un rótulo.
  if (!tienePunto && !direccion && !zona) return null;

  async function llegar() {
    if (!tienePunto) return;
    const etiqueta = encodeURIComponent(propiedad.nombre ?? "Propiedad");
    // La app nativa primero: en iOS, Apple Maps; en Android, la navegación de
    // Google. Si ninguna atiende el esquema queda el enlace web, que abre la
    // app de Google Maps si está instalada y el navegador si no.
    const nativo = Platform.select({
      ios: `maps://?daddr=${lat},${lng}&dirflg=d`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${etiqueta})`,
      default: "",
    });
    try {
      if (nativo && (await Linking.canOpenURL(nativo))) {
        await Linking.openURL(nativo);
        return;
      }
    } catch {
      // Cae al enlace web.
    }
    await Linking.openURL(enlaceParaLlegar(lat as number, lng as number));
  }

  return (
    <View style={styles.tarjeta}>
      {tienePunto ? <Estampa lat={lat as number} lng={lng as number} /> : null}

      <View style={styles.pie}>
        <View style={styles.texto}>
          <Text variant="bodyLarge" style={styles.direccion} numberOfLines={2}>
            {direccion || propiedad.nombre || "Sin dirección"}
          </Text>
          {zona ? (
            <Text variant="bodySmall" style={styles.zona} numberOfLines={1}>
              {zona}
            </Text>
          ) : null}
          {!tienePunto ? (
            <Text variant="bodySmall" style={styles.sinPunto}>
              Sin ubicación en el mapa.
            </Text>
          ) : null}
        </View>

        {tienePunto ? (
          <PressableScale onPress={llegar} style={styles.accion}>
            <View style={styles.accionIcono}>
              <Ionicons name="navigate" size={20} color={tema.verde700} />
            </View>
            <Text style={styles.accionTexto}>Llegar</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/**
 * La foto del lugar, con el panel de franjas debajo.
 *
 * El respaldo va **abajo y siempre dibujado**, no en un `if`: así la tarjeta
 * mide lo mismo antes y después de que cargue la imagen —nada salta— y si la
 * imagen falla no queda un hueco, queda el panel. En un jardín sin señal eso
 * es lo normal, no la excepción.
 */
function Estampa({ lat, lng }: { lat: number; lng: number }) {
  const token = useAuthStore((s) => s.accessToken);
  const [fallo, setFallo] = useState(false);

  const uri =
    `${API_BASE_URL}/api/mobile/mapa` +
    `?lat=${lat}&lng=${lng}&ancho=${ANCHO_PEDIDO}&alto=${ALTO_PEDIDO}&zoom=${ZOOM}`;

  return (
    <View style={styles.lienzo}>
      <Franjas />
      {!fallo && token ? (
        <Image
          // El token va en el encabezado porque la ruta pide sesión: es una
          // imagen que se factura, no un proxy abierto al que cualquiera le
          // pueda pedir mapas del mundo con nuestra cuenta.
          source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
          style={StyleSheet.absoluteFill}
          // La tarjeta tiene la misma proporción que la imagen, así que esto
          // no recorta nada: solo la escala al ancho que haya.
          resizeMode="cover"
          onError={() => setFallo(true)}
        />
      ) : null}
      <View style={styles.pin}>
        <Ionicons name="location" size={44} color={tema.verde} />
      </View>
    </View>
  );
}

/** Franjas diagonales, como el papel de un plano. Dibujadas, no descargadas. */
function Franjas() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 14 }).map((_, i) => (
        <View key={i} style={[styles.franja, { left: i * 26 - 60 }]} />
      ))}
    </View>
  );
}

/**
 * El tamaño que se le pide a Google, en píxeles lógicos (los manda al doble,
 * para pantallas retina).
 *
 * **El ancho no es el de la tarjeta, y tiene que ser este.** La imagen trae
 * abajo la atribución —"Map data ©2026 Imagery ©2026 Airbus, CNES / Airbus,
 * Maxar Technologies"—, que los términos de Maps Platform obligan a mostrar
 * legible, y **Google la recorta él mismo** cuando la imagen sale angosta: a
 * 343 de ancho (lo que mide la tarjeta en un iPhone) la línea llegaba cortada a
 * la mitad de una palabra. Desde 800 px reales —400 lógicos al doble— entra
 * entera.
 *
 * Así que se pide siempre esta medida y la tarjeta usa **su misma proporción**,
 * con lo cual no hay recorte en ningún lado: en un teléfono de 343 se ve a unos
 * 189 de alto, y en uno más ancho, más grande.
 *
 * El alto pasó de 150 a esta proporción porque a 150 el mapa era una franja
 * —entraba la manzana y poco más, con la atribución comiéndose una quinta
 * parte—. Ahora entra la cuadra con sus accesos, que es lo que se mira antes de
 * salir.
 */
const ANCHO_PEDIDO = 400;
const ALTO_PEDIDO = 220;

/**
 * Cuánto acercar.
 *
 * 17 es donde se leen el nombre de la urbanización y el de la calle de entrada
 * —que es lo que orienta a quien nunca fue— sin perder de vista la casa. En 18
 * queda un techo sin contexto; en 16, una mancha de urbanización sin saber
 * cuál es.
 */
const ZOOM = 17;

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.linea,
  },

  lienzo: {
    width: "100%",
    aspectRatio: ANCHO_PEDIDO / ALTO_PEDIDO,
    backgroundColor: tema.verde50,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  franja: {
    position: "absolute",
    top: -40,
    width: 10,
    height: 260,
    backgroundColor: "#ffffff",
    opacity: 0.55,
    transform: [{ rotate: "24deg" }],
  },
  pin: {
    // Medio alto para arriba: lo que señala un pin es su **punta**, y centrando
    // el dibujo la punta caía debajo del punto.
    transform: [{ translateY: -20 }],
    // La sombra despega el pin del fondo, que si no se lee como un dibujo más
    // de las franjas.
    shadowColor: "#142819",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  pie: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  texto: { flex: 1, gap: 2 },
  direccion: { color: tema.texto, fontWeight: "600" },
  zona: { color: tema.texto3 },
  sinPunto: { color: tema.texto3, marginTop: 2 },

  accion: { alignItems: "center", gap: 4 },
  accionIcono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  accionTexto: { color: tema.verde700, fontSize: 12, fontWeight: "600" },
});
